# Female teaching release evidence

The current model has **no independent anatomical or movement-education approval**. The checklist deliberately contains pending reviews. Never populate reviewer identities, findings or approvals speculatively.

Run `npm run validate:female-readiness` from the repository root. It runs integrity checks on all three bundled atlases, derives the 20-target female coverage directly from the current manifest, and verifies the checklist. Exit 1 is expected until the release evidence is complete. `npm run test:female-readiness` tests the gate using synthetic fixtures; a passing unit test is not a passing release review.

A reviewer should save measurements, annotated views/sections and pose observations in this directory. Each approved category needs a conclusion, evidence paths relative to the repository root with SHA-256 hashes, and an identified reviewer with role (`anatomist` or `movement-educator`), qualifications, `independentOfImplementation: true`, and `reviewedAt: YYYY-MM-DD`. The final teaching-scope category needs both roles. Independence is a recorded declaration; this script cannot verify identity or professional judgment.

The `modelDigest` must equal the output of `node scripts/validate-female-readiness.mjs --fingerprint`. It covers the female manifest, fit report, geometry buffers (including compressed downloads), and the anatomy, scene and page presentation code. Geometry or presentation changes require review of the changed revision and a new fingerprint. Do not update the fingerprint alone to bypass review.

Coverage exclusions require a target ID, a reason, an explicit `excludedTeachingClaim`, and approved coverage and teaching-scope reviews. Exclusions narrow teaching claims; they do not repair a missing or mislabeled structure. Currently none are approved. Each required pose case needs `id`, `status: approved`, `findings` and `evidencePath` matching an artifact listed in the poses review. The required case IDs are in `REQUIRED_POSES` in the validator. Camera orbit and exploded layout are not joint movement evidence.

This is a manual milestone release gate, separate from building a development preview. It is not wired to block all Vite builds or to change the Linear milestone automatically. A successful gate checks the completeness and freshness of the recorded evidence for the declared scope; it does not certify the model by itself.
