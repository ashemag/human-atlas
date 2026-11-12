import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import {createHash, generateKeyPairSync, randomBytes, sign as cryptoSign} from 'node:crypto';
import path from 'node:path';
import {unzipSync, strFromU8} from 'fflate';
import {assetNames, prepareAssets, combineAssets, verifyAssets} from './release-assets.mjs';
import {verifyUpdaterSignature} from './updater-signature.mjs';
import {staticAssetUrl} from '../app/core/static-asset.ts';
import {nextVersion, parseVersion, readVersions, releasePlan, repositoryRoot, syncVersion, versionFiles} from './release-version.mjs';

assert.equal(nextVersion('0.1.0'), '0.1.1');
assert.equal(nextVersion('2.9.99', 'minor'), '2.10.0');
assert.equal(nextVersion('2.9.99', 'major'), '3.0.0');
for (const invalid of ['01.2.3', 'v1.2.3', '1.2.3-beta.1', '1.2', '../1.2.3', '1.2.65536']) {
  assert.throws(() => parseVersion(invalid));
}
assert.throws(() => nextVersion('1.2.3', 'unknown'));
assert.throws(() => nextVersion('1.2.65535'));
readVersions();

const temporaryParent = fs.realpathSync(os.tmpdir());
const root = fs.mkdtempSync(path.join(temporaryParent, 'anatolume-release-'));
const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
try {
  for (const file of versionFiles) {
    fs.mkdirSync(path.dirname(path.join(root, file)), {recursive: true});
    fs.copyFileSync(path.join(repositoryRoot, file), path.join(root, file));
  }
  const dependencyLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  syncVersion('0.1.0', root);
  git(['init', '-b', 'main']);
  git(['config', 'user.name', 'Release validation']);
  git(['config', 'user.email', 'validation@example.invalid']);
  git(['add', '.']);
  git(['commit', '-m', 'Fixture']);
  const source = git(['rev-parse', 'HEAD']);
  const plan = options => releasePlan({root, enabled: true, source, runId: '100', ...options});
  assert.equal(plan().version, '0.1.1', 'First release increments the source version');
  git(['tag', 'v0.1.9']);
  git(['tag', 'v0.1.10']);
  git(['tag', 'v99.0.0-beta.1']);
  git(['tag', 'unrelated-tag']);
  assert.equal(plan().version, '0.1.11', 'Tags are compared numerically; prerelease/unrelated names are ignored');
  assert.equal(plan({bump: 'minor'}).version, '0.2.0');
  assert.equal(plan({bump: 'major'}).version, '1.0.0');
  assert.equal(plan({bump: 'major'}).prerelease, false);
  assert.equal(plan().prerelease, true);
  assert.deepEqual(plan({enabled: false}), {version: '0.1.0', tag: 'v0.1.0', release: false, prerelease: true}, 'PR checks do not allocate a release');

  syncVersion('0.1.11', root);
  git(['add', '.']);
  git(['commit', '-m', 'Release fixture', '-m', `Release-Run: 100\nRelease-Source: ${source}\nRelease-Bump: patch`]);
  git(['tag', '-a', 'v0.1.11', '-m', 'Fixture release']);
  assert.equal(plan().version, '0.1.11', 'Retry reuses the existing version');
  assert.equal(plan({runId: '101'}).version, '0.1.12', 'A new run advances the version');
  assert.throws(() => plan({source: '0'.repeat(40)}), /Retry source/);
  assert.throws(() => plan({bump: 'major'}), /Retry bump/);

  const updatedLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  assert.deepEqual(updatedLock.packages[''].dependencies, dependencyLock.packages[''].dependencies);
  assert.deepEqual(updatedLock.packages[''].devDependencies, dependencyLock.packages[''].devDependencies);
  delete updatedLock.packages[''];
  delete dependencyLock.packages[''];
  assert.deepEqual(updatedLock.packages, dependencyLock.packages, 'Version synchronization must not change dependency resolutions');
  assert.equal(readVersions(root), '0.1.11');
  const before = versionFiles.map(file => fs.readFileSync(path.join(root, file), 'utf8'));
  assert.throws(() => syncVersion('invalid', root));
  assert.deepEqual(versionFiles.map(file => fs.readFileSync(path.join(root, file), 'utf8')), before, 'Invalid input must not change version files');
  const configPath = path.join(root, 'src-tauri/tauri.conf.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.version = '0.2.0';
  fs.writeFileSync(configPath, JSON.stringify(config));
  assert.throws(() => readVersions(root), /Version files disagree/);

  const version = '0.1.11';
  const directory = path.join(root, 'assets');
  const native = path.join(root, 'src-tauri/target/x86_64-pc-windows-msvc/release');
  const dmg = path.join(root, 'src-tauri/target/universal-apple-darwin/release/bundle/dmg');
  for (const folder of [native + '/bundle/nsis', dmg, root + '/public', root + '/dist/models']) fs.mkdirSync(folder, {recursive: true});
  fs.writeFileSync(native + '/bundle/nsis/Anatolume_' + version + '_x64-setup.exe', 'Fixture installer');
  const {privateKey, publicKey} = generateKeyPairSync('ed25519');
  const keyId = randomBytes(8);
  config.plugins.updater.pubkey = Buffer.from('untrusted comment: fixture public key\n' + Buffer.concat([Buffer.from('Ed'), keyId, publicKey.export({format: 'der', type: 'spki'}).subarray(-32)]).toString('base64') + '\n').toString('base64');
  fs.writeFileSync(configPath, JSON.stringify(config));
  const sign = file => {
    const signature = cryptoSign(null, createHash('blake2b512').update(fs.readFileSync(file)).digest(), privateKey);
    const comment = `timestamp:1\tfile:fixture\tversion:${version}`;
    const global = cryptoSign(null, Buffer.concat([signature, Buffer.from(comment)]), privateKey);
    fs.writeFileSync(file + '.sig', Buffer.from(`untrusted comment: fixture\n${Buffer.concat([Buffer.from('ED'), keyId, signature]).toString('base64')}\ntrusted comment: ${comment}\n${global.toString('base64')}\n`).toString('base64'));
  };
  sign(native + '/bundle/nsis/Anatolume_' + version + '_x64-setup.exe');
  fs.writeFileSync(native + '/anatolume.exe', 'Fixture portable executable');
  fs.writeFileSync(dmg + '/Anatolume_' + version + '_universal.dmg', 'Fixture disk image');
  const macBundle = path.join(root, 'src-tauri/target/universal-apple-darwin/release/bundle/macos');
  fs.mkdirSync(macBundle, {recursive: true});
  fs.writeFileSync(macBundle + '/Anatolume.app.tar.gz', 'Fixture universal update');
  sign(macBundle + '/Anatolume.app.tar.gz');
  fs.writeFileSync(dmg + '/Human Atlas_0.1.0_universal.dmg', 'Stale cached bundle must not enter the release');
  fs.writeFileSync(root + '/public/ATTRIBUTION.md', 'Fixture attribution');
  fs.writeFileSync(root + '/LICENSE', 'Fixture license');
  fs.writeFileSync(root + '/dist/index.html', '<html>Fixture Web build</html>');
  fs.writeFileSync(root + '/dist/models/atlas.json', '{}');
  const options = {version, directory, root, source, runUrl: 'https://github.com/example/project/actions/runs/100', sign};
  for (const platform of ['windows', 'macos', 'web']) prepareAssets({...options, platform});
  assert.deepEqual(combineAssets(options), [...Object.values(assetNames(version)).flat(), 'latest.json', 'SHA256SUMS', 'BUILD-REPORT.md']);
  const portable = unzipSync(fs.readFileSync(path.join(directory, assetNames(version).windows[1])));
  assert.equal(strFromU8(portable['Anatolume.exe']), 'Fixture portable executable');
  assert.ok(strFromU8(portable['README.txt']).includes('WebView2'));
  assert.ok(portable['ATTRIBUTION.md'] && portable.LICENSE);
  assert.deepEqual(JSON.parse(strFromU8(portable['anatolume-portable.json'])), {edition: 'portable', version});
  const latestPath = path.join(directory, 'latest.json');
  const latest = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
  assert.equal(latest.version, version);
  assert.equal(latest.platforms['windows-x86_64-portable'].signature, fs.readFileSync(path.join(directory, assetNames(version).windows[3]), 'utf8'));
  const portableBytes = fs.readFileSync(path.join(directory, assetNames(version).windows[1]));
  const portableSignature = latest.platforms['windows-x86_64-portable'].signature;
  const pubkey = config.plugins.updater.pubkey;
  verifyUpdaterSignature(portableBytes, portableSignature, pubkey, version);
  assert.throws(() => verifyUpdaterSignature(Buffer.concat([portableBytes, Buffer.from('tampered')]), portableSignature, pubkey, version), /artifact signature/);
  const changedComment = Buffer.from(Buffer.from(portableSignature, 'base64').toString().replace(`version:${version}`, 'version:99.0.0')).toString('base64');
  assert.throws(() => verifyUpdaterSignature(portableBytes, changedComment, pubkey, '99.0.0'), /trusted comment signature/);
  assert.throws(() => verifyUpdaterSignature(portableBytes, portableSignature, pubkey, '99.0.0'), /bound to the release version/);
  const changedKeyLines = Buffer.from(pubkey, 'base64').toString().trimEnd().split('\n');
  const changedKey = Buffer.from(changedKeyLines[1], 'base64');
  changedKey[41] ^= 1;
  changedKeyLines[1] = changedKey.toString('base64');
  assert.throws(() => verifyUpdaterSignature(portableBytes, portableSignature, Buffer.from(changedKeyLines.join('\n')).toString('base64'), version), /artifact signature/);
  assert.equal(latest.platforms['darwin-aarch64'].url, latest.platforms['darwin-x86_64'].url);
  assert.ok(latest.platforms['windows-x86_64-portable'].url.endsWith('.zip'));
  assert.ok(latest.platforms['windows-x86_64'].url.endsWith('setup.exe'));
  for (const invalid of [
    {...latest, version: '99.0.0'},
    {...latest, platforms: {...latest.platforms, 'windows-x86_64-portable': latest.platforms['windows-x86_64']}},
    {...latest, platforms: {...latest.platforms, 'darwin-aarch64': {...latest.platforms['darwin-aarch64'], url: 'http://untrusted.invalid/update'}}},
    {...latest, notes: ''},
  ]) {
    fs.writeFileSync(latestPath, JSON.stringify(invalid));
    assert.throws(() => verifyAssets(version, directory, source, root));
  }
  combineAssets(options);
  const web = unzipSync(fs.readFileSync(path.join(directory, assetNames(version).web[0])));
  assert.ok(web['index.html'] && web['models/atlas.json']);
  assert.equal(JSON.parse(strFromU8(web['version.json'])).version, version);
  assert.equal(JSON.parse(strFromU8(web['version.json'])).source, source);
  assert.ok(strFromU8(web['README-WEB.txt']).includes('HTTP/HTTPS'));
  for (const platform of ['windows', 'macos', 'web']) prepareAssets({...options, platform});
  combineAssets(options);
  assert.equal(verifyAssets(version, directory, source, root).length, 11, 'Repeated preparation preserves valid assets');
  const receiptPath = path.join(directory, 'macos.json');
  const originalReceipt = fs.readFileSync(receiptPath, 'utf8');
  const receipt = JSON.parse(originalReceipt);
  receipt.version = '0.1.12';
  fs.writeFileSync(receiptPath, JSON.stringify(receipt));
  assert.throws(() => combineAssets(options), /version does not match/);
  receipt.version = version;
  receipt.source = '0'.repeat(40);
  fs.writeFileSync(receiptPath, JSON.stringify(receipt));
  assert.throws(() => combineAssets(options), /share one source/);
  receipt.source = source;
  receipt.runUrl = 'https://github.com/example/project/actions/runs/101';
  fs.writeFileSync(receiptPath, JSON.stringify(receipt));
  assert.throws(() => combineAssets(options), /share one workflow/);
  fs.writeFileSync(receiptPath, originalReceipt);
  fs.renameSync(receiptPath, receiptPath + '.backup');
  assert.throws(() => combineAssets(options), /ENOENT/, 'A missing platform blocks publishing');
  fs.renameSync(receiptPath + '.backup', receiptPath);
  fs.appendFileSync(path.join(directory, assetNames(version).windows[1]), 'changed');
  assert.throws(() => verifyAssets(version, directory, source, root), /checksum does not match/);
} finally {
  // Remove only this test's freshly-created directory inside the resolved temp parent.
  const resolved = fs.realpathSync(root);
  assert.equal(path.dirname(resolved), temporaryParent);
  assert.ok(path.basename(resolved).startsWith('anatolume-release-'));
  fs.rmSync(resolved, {recursive: true, force: true});
}
assert.equal(staticAssetUrl('/models/atlas.json', './', 'https://isunky.github.io/Anatolume/'), 'https://isunky.github.io/Anatolume/models/atlas.json');
assert.equal(staticAssetUrl('/models/model.bin.gz', '/', 'https://example.com/'), 'https://example.com/models/model.bin.gz');
assert.equal(staticAssetUrl('/models/atlas.json', './', 'http://tauri.localhost/'), 'http://tauri.localhost/models/atlas.json');
console.log('Verified SemVer increments, five synchronized version files, tag ordering, retry reuse, PR isolation, portable/Web ZIP contents, platform provenance and all asset checksums.');
