import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {collectContext, evaluateReadiness, REQUIRED_REVIEWS, REQUIRED_POSES} from './validate-female-readiness.mjs';
import {TARGETS} from './anatomy-coverage.mjs';

function fixture() {
 const digest = 'a'.repeat(64), evidencePath = 'data/anatomy/reviews/fixture.md';
 const reviewers = ['anatomist', 'movement-educator'].map(role => ({name: 'Test fixture reviewer', qualifications: 'Synthetic test only', role, independentOfImplementation: true, reviewedAt: '2026-09-06'}));
 const review = {schemaVersion: 1, modelDigest: digest, supportedTeachingClaims: 'Synthetic fixture only', coverageExclusions: [], reviews: Object.fromEntries(REQUIRED_REVIEWS.map(id => [id, {status: 'approved', conclusion: 'Synthetic reviewed finding', reviewers, evidence: [{path: evidencePath, sha256: digest}]}]))};
 review.reviews.poses.cases = REQUIRED_POSES.map(id => ({id, status: 'approved', findings: 'Synthetic observation', evidencePath}));
 const context = {integrityPassed: true, modelDigest: digest, evidenceHashes: {[evidencePath]: digest}, coverage: TARGETS.map(t => ({id: t.id, status: 'named_meshes_present'}))};
 return {review, context};
}

test('mesh integrity and named coverage alone cannot approve teaching release', () => {
 const {context} = fixture();
 const result = evaluateReadiness({schemaVersion: 1, modelDigest: context.modelDigest}, context);
 assert.equal(result.ready, false);
 for (const id of REQUIRED_REVIEWS) assert.ok(result.failures.some(f => f.startsWith(`${id}:`)));
});
test('complete synthetic evidence is accepted, but geometry or presentation changes invalidate it', () => {
 const {review, context} = fixture();
 assert.equal(evaluateReadiness(review, context).ready, true);
 assert.equal(evaluateReadiness(review, {...context, modelDigest: 'b'.repeat(64)}).ready, false);
 assert.equal(evaluateReadiness(review, {...context, integrityPassed: false}).ready, false);
});
test('deleted review categories, changed artifacts and implementer self-review are rejected', () => {
 for (const mutate of [r => delete r.reviews.attachments, r => {r.reviews.sections.evidence[0].sha256 = 'b'.repeat(64);}, r => {r.reviews.landmarks.reviewers = [{name: 'Implementer', role: 'anatomist', independentOfImplementation: false}];}]) {
  const {review, context} = fixture(); mutate(review); assert.equal(evaluateReadiness(review, context).ready, false);
 }
});
test('pose evidence must include every required motion with a linked artifact', () => {
 const {review, context} = fixture(); review.reviews.poses.cases.pop();
 assert.equal(evaluateReadiness(review, context).ready, false);
});
test('a missing or concept-only target needs an explicit reviewed scope exclusion', () => {
 const {review, context} = fixture(); context.coverage[0].status = 'concept_only';
 assert.equal(evaluateReadiness(review, context).ready, false);
 review.coverageExclusions.push({id: TARGETS[0].id, reason: 'Synthetic unavailable structure', excludedTeachingClaim: 'No teaching of this structure'});
 assert.equal(evaluateReadiness(review, context).ready, true);
 review.reviews.teachingScope.status = 'pending';
 assert.equal(evaluateReadiness(review, context).ready, false);
});


test('CSS and route-entry changes invalidate an otherwise complete review with unchanged geometry', t => {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), 'female-readiness-digest-'));
 t.after(() => fs.rmSync(root, {recursive: true, force: true}));
 const files = {
  'public/models/atlas-female-reconstructed.json': JSON.stringify({parts: [], concepts: [], chunks: [{url: '/models/fixture.bin'}]}),
  'public/models/fixture.bin': 'unchanged synthetic geometry',
  'public/models/female-fit-report.json': '{}',
  'app/anatomy.ts': 'export const description = "fixture";',
  'app/page.tsx': 'export default function Page() {}',
  'app/scene.tsx': 'export default function Scene() {}',
  'app/globals.css': '.scene { display: block; }',
  'web/main.tsx': 'const model = "female";',
 };
 for (const [name, contents] of Object.entries(files)) {
  const filename = path.join(root, name);
  fs.mkdirSync(path.dirname(filename), {recursive: true});
  fs.writeFileSync(filename, contents);
 }
 const baseline = collectContext(root);
 const {review, context} = fixture();
 review.modelDigest = baseline.modelDigest;
 assert.equal(evaluateReadiness(review, {...context, modelDigest: baseline.modelDigest}).ready, true);
 for (const [name, changed] of [['app/globals.css', '.scene { display: none; }'], ['web/main.tsx', 'const model = "male";']]) {
  fs.writeFileSync(path.join(root, name), changed);
  const current = collectContext(root);
  assert.notEqual(current.modelDigest, baseline.modelDigest, `${name} must invalidate the reviewed revision`);
  const result = evaluateReadiness(review, {...context, modelDigest: current.modelDigest});
  assert.equal(result.ready, false);
  assert.ok(result.failures.some(message => message.includes('digest')));
  fs.writeFileSync(path.join(root, name), files[name]);
  assert.equal(collectContext(root).modelDigest, baseline.modelDigest);
 }
});
