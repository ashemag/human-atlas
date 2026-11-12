import assert from 'node:assert/strict';
import {createHash, createPublicKey, verify} from 'node:crypto';

// Minisign's Ed25519 prehashed format, also used by Tauri's minisign-verify crate.
// Check both the artifact signature and the trusted comment containing its version.
export function verifyUpdaterSignature(bytes, encodedSignature, encodedPublicKey, version) {
  const decode = value => {
    assert.match(value, /^[A-Za-z0-9+/]+={0,2}$/, 'Invalid updater signature encoding');
    return Buffer.from(value, 'base64');
  };
  const lines = decode(encodedSignature.trim()).toString('utf8').trimEnd().split(/\r?\n/);
  const keyLines = decode(encodedPublicKey.trim()).toString('utf8').trimEnd().split(/\r?\n/);
  assert.equal(lines.length, 4, 'Invalid updater signature');
  assert.equal(keyLines.length, 2, 'Invalid updater public key');
  assert.ok(lines[0].startsWith('untrusted comment:') && keyLines[0].startsWith('untrusted comment:'));
  assert.ok(lines[2].startsWith('trusted comment: '), 'Missing trusted comment');
  const signature = decode(lines[1]);
  const globalSignature = decode(lines[3]);
  const key = decode(keyLines[1]);
  assert.equal(signature.length, 74);
  assert.equal(globalSignature.length, 64);
  assert.equal(key.length, 42);
  assert.equal(signature.subarray(0, 2).toString(), 'ED', 'Expected a prehashed Minisign signature');
  assert.ok(['Ed', 'ED'].includes(key.subarray(0, 2).toString()));
  assert.deepEqual(signature.subarray(2, 10), key.subarray(2, 10), 'Updater signing key does not match');
  const publicKey = createPublicKey({format: 'der', type: 'spki', key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key.subarray(10)])});
  const artifactSignature = signature.subarray(10);
  assert.ok(verify(null, createHash('blake2b512').update(bytes).digest(), publicKey, artifactSignature), 'Updater artifact signature does not match');
  const comment = lines[2].slice('trusted comment: '.length);
  assert.ok(verify(null, Buffer.concat([artifactSignature, Buffer.from(comment)]), publicKey, globalSignature), 'Updater trusted comment signature does not match');
  assert.equal(comment.split('\t').find(field => field.startsWith('version:'))?.slice(8), version, 'Updater signature must be bound to the release version');
}
