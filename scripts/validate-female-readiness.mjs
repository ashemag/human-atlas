import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {TARGETS, summarizeAtlas} from './anatomy-coverage.mjs';

export const REQUIRED_REVIEWS = ['coverage', 'landmarks', 'attachments', 'sections', 'tissuePresentation', 'poses', 'teachingScope'];
export const REQUIRED_POSES = ['standing', 'overhead-reach', 'hip-flexion-squat', 'bridge', 'spinal-rotation', 'side-bend'];
const sha = data => createHash('sha256').update(data).digest('hex');
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const digestPattern = /^[a-f0-9]{64}$/;

// Deliberately separate integrity, discoverability, and documented anatomical review.
// This verifies the evidence record, not the truth of a reviewer's clinical judgment.
export function evaluateReadiness(review, context) {
 const failures = [];
 if (review.schemaVersion !== 1) failures.push('Unsupported review schema.');
 if (!context.integrityPassed) failures.push('Automated atlas integrity checks have not passed.');
 if (!digestPattern.test(review.modelDigest ?? '') || review.modelDigest !== context.modelDigest) failures.push('Review does not match the current model, geometry, fit report and presentation code digest.');
 if (!nonempty(review.supportedTeachingClaims)) failures.push('Supported teaching claims must be stated.');
 for (const id of REQUIRED_REVIEWS) {
  const item = review.reviews?.[id];
  if (item?.status !== 'approved') { failures.push(`${id}: independent review remains unresolved.`); continue; }
  if (!nonempty(item.conclusion)) failures.push(`${id}: review conclusion is missing.`);
  const reviewers = Array.isArray(item.reviewers) ? item.reviewers : [];
  const roles = id === 'teachingScope' ? ['anatomist', 'movement-educator'] : [id === 'poses' ? 'movement-educator' : 'anatomist'];
  for (const role of roles) if (!reviewers.some(r => r.role === role && nonempty(r.name) && nonempty(r.qualifications) && r.independentOfImplementation === true && /^\d{4}-\d{2}-\d{2}$/.test(r.reviewedAt ?? '') && Number.isFinite(Date.parse(r.reviewedAt)))) failures.push(`${id}: an identified independent ${role} must review this revision.`);
  const evidence = Array.isArray(item.evidence) ? item.evidence : [];
  if (!evidence.length) failures.push(`${id}: no review evidence artifacts recorded.`);
  for (const entry of evidence) if (!nonempty(entry.path) || !digestPattern.test(entry.sha256 ?? '') || context.evidenceHashes[entry.path] !== entry.sha256) failures.push(`${id}: missing or changed evidence artifact ${entry.path ?? '(unnamed)'}.`);
 }
 const poseEvidence = review.reviews?.poses?.cases ?? [];
 for (const id of REQUIRED_POSES) if (!poseEvidence.some(p => p.id === id && p.status === 'approved' && nonempty(p.findings) && review.reviews?.poses?.evidence?.some(e => e.path === p.evidencePath))) failures.push(`poses: ${id} lacks an approved case with linked review evidence.`);
 for (const target of TARGETS) {
  const result = context.coverage.find(t => t.id === target.id);
  const exclusion = review.coverageExclusions?.find(t => t.id === target.id);
  if (exclusion && (!nonempty(exclusion.reason) || !nonempty(exclusion.excludedTeachingClaim) || review.reviews?.coverage?.status !== 'approved' || review.reviews?.teachingScope?.status !== 'approved')) failures.push(`coverage: ${target.id} exclusion needs a reason, excluded teaching claim and approved coverage/scope reviews.`);
  if (result?.status !== 'named_meshes_present' && !exclusion) failures.push(`coverage: ${target.id} has no separately named mesh and no reviewed teaching-scope exclusion.`);
 }
 return {ready: failures.length === 0, integrityPassed: context.integrityPassed, modelDigest: context.modelDigest, failures, limits: 'Passing checks records evidence completeness for the declared teaching scope; it does not independently certify anatomical accuracy or reviewer identity.'};
}

export function collectContext(root) {
 const read = relative => fs.readFileSync(path.join(root, relative));
 const atlasPath = 'public/models/atlas-female-reconstructed.json';
 const atlas = JSON.parse(read(atlasPath));
 const assets = [atlasPath, 'public/models/female-fit-report.json', 'app/anatomy.ts', 'app/scene.tsx', 'app/page.tsx', 'app/globals.css', 'web/main.tsx'];
 for (const chunk of atlas.chunks) {
  assets.push(`public${chunk.url}`);
  if (chunk.gzip) assets.push(`public${chunk.gzip}`);
 }
 const modelDigest = sha([...new Set(assets)].sort().map(name => `${name}\0${sha(read(name))}\n`).join(''));
 const coverage = TARGETS.map(target => ({id: target.id, ...summarizeAtlas(atlas, target)}));
 return {modelDigest, coverage, assets};
}

export function run(root, args = []) {
 const context = collectContext(root);
 if (args.includes('--fingerprint')) { console.log(context.modelDigest); return 0; }
 const review = JSON.parse(fs.readFileSync(path.join(root, 'data/anatomy/female-review-checklist.json')));
 let integrityPassed = true;
 for (const atlas of ['atlas.json', 'atlas-female.json', 'atlas-female-reconstructed.json']) {
  const result = spawnSync(process.execPath, ['scripts/validate-atlas.mjs', atlas], {cwd: root, encoding: 'utf8'});
  if (result.status !== 0) { integrityPassed = false; console.error(result.stdout, result.stderr); }
 }
 if (collectContext(root).modelDigest !== context.modelDigest) {
  integrityPassed = false;
  console.error('Model or presentation changed during validation; rerun against a stable revision.');
 }
 const evidenceHashes = {};
 for (const item of Object.values(review.reviews ?? {})) for (const artifact of item.evidence ?? []) {
  if (typeof artifact.path !== 'string') continue;
  const absolute = path.resolve(root, artifact.path);
  // Review artifacts must be checked into data/anatomy/reviews; no arbitrary file reads.
  const reviewRoot = fs.realpathSync(path.join(root, 'data/anatomy/reviews')) + path.sep;
  try { if (fs.realpathSync(absolute).startsWith(reviewRoot)) evidenceHashes[artifact.path] = sha(fs.readFileSync(absolute)); } catch { /* Report missing evidence below. */ }
 }
 const result = evaluateReadiness(review, {...context, integrityPassed, evidenceHashes});
 console.log(JSON.stringify(result, null, 2));
 return result.ready ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
 try { process.exitCode = run(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), process.argv.slice(2)); }
 catch (error) { console.error(`Female release readiness failed: ${error.message}`); process.exitCode = 1; }
}
