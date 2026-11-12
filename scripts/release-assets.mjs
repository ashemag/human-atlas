import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {zipSync, strToU8} from 'fflate';
import {parseVersion, readVersions, repositoryRoot} from './release-version.mjs';
import {generateUpdateNotes} from './release-notes.mjs';
import {verifyUpdaterSignature} from './updater-signature.mjs';

const platforms = ['windows', 'macos', 'web'];
export const assetNames = version => ({
  windows: [`Anatolume_${version}_x64-setup.exe`, `Anatolume_${version}_Windows-x64-portable.zip`, `Anatolume_${version}_x64-setup.exe.sig`, `Anatolume_${version}_Windows-x64-portable.zip.sig`],
  macos: [`Anatolume_${version}_macOS-universal.dmg`, `Anatolume_${version}_macOS-universal.app.tar.gz`, `Anatolume_${version}_macOS-universal.app.tar.gz.sig`],
  web: [`Anatolume_${version}_Web.zip`],
});
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readme = version => `Anatolume ${version}\n\n`;

function signArtifact(file, version) {
  assert.ok(process.env.TAURI_SIGNING_PRIVATE_KEY || process.env.TAURI_SIGNING_PRIVATE_KEY_PATH, 'Updater signing key is required');
  // Never pass private keys/passwords in command arguments or print signer output.
  execFileSync(process.execPath, [path.join(repositoryRoot, 'node_modules/@tauri-apps/cli/tauri.js'), 'signer', 'sign', '--app-version', version, file], {stdio: 'pipe'});
}

export function readSignature(file, version, pubkey) {
  const signature = fs.readFileSync(file, 'utf8').trim();
  verifyUpdaterSignature(fs.readFileSync(file.slice(0, -4)), signature, pubkey, version);
  return signature;
}

function archiveTree(directory, prefix = '', entries = {}) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const name = prefix + entry.name;
    assert.ok(!entry.isSymbolicLink(), `Archive must not contain symlinks: ${name}`);
    if (entry.isDirectory()) archiveTree(path.join(directory, entry.name), name + '/', entries);
    else entries[name] = fs.readFileSync(path.join(directory, entry.name));
  }
  return entries;
}

export function prepareAssets({platform, version, source, runUrl, root = repositoryRoot, directory = path.join(root, 'release-assets'), sign = signArtifact}) {
  parseVersion(version);
  assert.ok(platforms.includes(platform), 'Unknown release platform');
  fs.mkdirSync(directory, {recursive: true});
  const names = assetNames(version)[platform];
  if (platform === 'windows') {
    const binaryDirectory = path.join(root, 'src-tauri/target/x86_64-pc-windows-msvc/release');
    fs.copyFileSync(path.join(binaryDirectory, `bundle/nsis/Anatolume_${version}_x64-setup.exe`), path.join(directory, names[0]));
    fs.copyFileSync(path.join(binaryDirectory, `bundle/nsis/Anatolume_${version}_x64-setup.exe.sig`), path.join(directory, names[2]));
    fs.writeFileSync(path.join(directory, names[1]), zipSync({
      'Anatolume.exe': fs.readFileSync(path.join(binaryDirectory, 'anatolume.exe')),
      'README.txt': strToU8(readme(version) + 'Windows x64 portable edition / Windows x64 便携版\n\n解压后运行 Anatolume.exe，无需安装程序。离线模型已内嵌。\n需要已安装 Microsoft Edge WebView2 Runtime；缺少时请先安装官方运行时。\nDownload: https://developer.microsoft.com/microsoft-edge/webview2/\n本版本不内置 WebView2，浏览记录和语言设置保存在本机用户目录，不随 ZIP 迁移。\n启动时自动检查更新；在“关于与致谢 → 应用更新”下载安装。请保留 anatolume-portable.json，确保所在目录可写。更新校验签名后仅替换程序，不运行安装器。\n更新包带有校验签名，Windows 程序没有 Authenticode 系统代码签名。\n'),
      'ATTRIBUTION.md': fs.readFileSync(path.join(root, 'public/ATTRIBUTION.md')),
      'LICENSE': fs.readFileSync(path.join(root, 'LICENSE')),
      'anatolume-portable.json': strToU8(JSON.stringify({edition: 'portable', version})),
    }, {level: 6}));
    sign(path.join(directory, names[1]), version);
  } else if (platform === 'macos') {
    const bundle = path.join(root, 'src-tauri/target/universal-apple-darwin/release/bundle/dmg');
    const images = fs.readdirSync(bundle).filter(name => name === `Anatolume_${version}_universal.dmg`);
    assert.equal(images.length, 1, 'Expected exactly one universal macOS DMG');
    fs.copyFileSync(path.join(bundle, images[0]), path.join(directory, names[0]));
    const application = path.join(root, 'src-tauri/target/universal-apple-darwin/release/bundle/macos/Anatolume.app.tar.gz');
    fs.copyFileSync(application, path.join(directory, names[1]));
    fs.copyFileSync(application + '.sig', path.join(directory, names[2]));
  } else {
    const dist = path.join(root, 'dist');
    assert.ok(fs.existsSync(path.join(dist, 'index.html')), 'Web build is missing');
    const entries = archiveTree(dist);
    entries['README-WEB.txt'] = strToU8(readme(version) + '解压后将整个目录部署到静态 HTTP/HTTPS 服务器，支持域名根目录或子目录。\n请保留 assets/ 和 models/，不要使用 file:// 直接双击 index.html。\n本地预览：python -m http.server 8080，然后打开 http://localhost:8080。\n');
    fs.writeFileSync(path.join(dist, 'version.json'), JSON.stringify({version, source}, null, 2) + '\n');
    fs.writeFileSync(path.join(dist, '.nojekyll'), '');
    entries['version.json'] = fs.readFileSync(path.join(dist, 'version.json'));
    entries['.nojekyll'] = new Uint8Array();
    fs.writeFileSync(path.join(directory, names[0]), zipSync(entries, {level: 6}));
  }
  const pubkey = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri/tauri.conf.json'), 'utf8')).plugins.updater.pubkey;
  for (const name of names.filter(name => name.endsWith('.sig'))) readSignature(path.join(directory, name), version, pubkey);
  writeReceipt({platform, version, source, runUrl, directory});
  return names;
}

export function writeReceipt({platform, version, source, runUrl, directory}) {
  parseVersion(version);
  assert.ok(platforms.includes(platform));
  const assets = assetNames(version)[platform].map(name => ({name, sha256: digest(path.join(directory, name))}));
  fs.writeFileSync(path.join(directory, `${platform}.json`), JSON.stringify({platform, version, source, runUrl, assets}, null, 2) + '\n');
}

export function collectReceipts(version, directory, expectedSource) {
  parseVersion(version);
  const receipts = platforms.map(platform => {
    const receipt = JSON.parse(fs.readFileSync(path.join(directory, `${platform}.json`), 'utf8'));
    assert.equal(receipt.platform, platform);
    assert.equal(receipt.version, version, 'Artifact version does not match');
    assert.match(receipt.source, /^[a-f0-9]{40}$/);
    assert.match(receipt.runUrl, /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+$/);
    assert.deepEqual(receipt.assets.map(asset => asset.name), assetNames(version)[platform], 'Artifact names do not match');
    for (const asset of receipt.assets) {
      assert.equal(digest(path.join(directory, asset.name)), asset.sha256, `Asset checksum does not match: ${asset.name}`);
    }
    return receipt;
  });
  for (const receipt of receipts) {
    assert.equal(receipt.source, expectedSource || receipts[0].source, 'Artifacts must share one source commit');
    assert.equal(receipt.runUrl, receipts[0].runUrl, 'Artifacts must share one workflow run');
  }
  return receipts;
}

export function updaterPlatforms(version, directory, runUrl, pubkey) {
  const repository = runUrl.split('/').slice(3, 5).join('/');
  const names = assetNames(version);
  const target = (binary, signature) => ({url: `https://github.com/${repository}/releases/download/v${version}/${binary}`, signature: readSignature(path.join(directory, signature), version, pubkey)});
  return {
    'windows-x86_64': target(names.windows[0], names.windows[2]),
    'windows-x86_64-portable': target(names.windows[1], names.windows[3]),
    'darwin-x86_64': target(names.macos[1], names.macos[2]),
    'darwin-aarch64': target(names.macos[1], names.macos[2]),
  };
}

export function combineAssets({version, directory, source, root = repositoryRoot}) {
  const receipts = collectReceipts(version, directory, source);
  const pubkey = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri/tauri.conf.json'), 'utf8')).plugins.updater.pubkey;
  fs.writeFileSync(path.join(directory, 'latest.json'), JSON.stringify({
    version, notes: generateUpdateNotes({source: receipts[0].source, root}), pub_date: new Date().toISOString(),
    platforms: updaterPlatforms(version, directory, receipts[0].runUrl, pubkey),
  }, null, 2) + '\n');
  const checksums = [...receipts.flatMap(receipt => receipt.assets.map(asset => `${asset.sha256}  ${asset.name}`)), `${digest(path.join(directory, 'latest.json'))}  latest.json`].join('\n') + '\n';
  fs.writeFileSync(path.join(directory, 'SHA256SUMS'), checksums);
  fs.writeFileSync(path.join(directory, 'BUILD-REPORT.md'), [
    `# Anatolume ${version} · Windows / macOS / Web`, '',
    `- Version: ${version}`, `- Source commit: ${receipts[0].source}`, `- Workflow: ${receipts[0].runUrl}`, '',
    'All platforms passed core checks and were built from the same source and version.', '',
    '| Platform | Package | Requirements |', '| --- | --- | --- |',
    '| Windows x64 installer | NSIS EXE | WebView2; bootstrapper downloads a missing runtime |',
    '| Windows x64 portable | ZIP with embedded models and EXE | Existing WebView2; settings use the local user profile |',
    '| Desktop updates | Signed installer / portable ZIP / universal app.tar.gz + latest.json | Verified signatures bound to the version; portable stays portable |',
    '| macOS universal | DMG; Intel x64 + Apple Silicon arm64 | macOS 11+; ad-hoc signed, not Apple notarized |',
    '| Web | Static ZIP + GitHub Pages | Serve via HTTP/HTTPS; root or subdirectory supported |', '',
    'Desktop models are bundled offline. Update artifacts are signed; Windows has no Authenticode signing and macOS uses ad-hoc signing.',
    'Chinese terminology is an unreviewed draft. CI builds do not substitute for real-device testing.', '',
    '## SHA256', '', '```text', checksums.trimEnd(), '```', '',
  ].join('\n'));
  return verifyAssets(version, directory, source, root);
}

export function verifyAssets(version, directory, source, root = repositoryRoot) {
  const receipts = collectReceipts(version, directory, source);
  const assets = receipts.flatMap(receipt => receipt.assets);
  const latestPath = path.join(directory, 'latest.json');
  const manifest = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
  assert.equal(manifest.version, version, 'Updater version does not match');
  assert.ok(typeof manifest.notes === 'string' && manifest.notes.trim(), 'Updater notes are missing');
  assert.ok(typeof manifest.pub_date === 'string' && /T.*Z$/.test(manifest.pub_date) && !Number.isNaN(Date.parse(manifest.pub_date)), 'Updater date is invalid');
  const pubkey = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri/tauri.conf.json'), 'utf8')).plugins.updater.pubkey;
  assert.deepEqual(manifest.platforms, updaterPlatforms(version, directory, receipts[0].runUrl, pubkey), 'Updater targets, URLs or signatures do not match');
  const checksumAssets = [...assets, {name: 'latest.json', sha256: digest(latestPath)}];
  assert.equal(fs.readFileSync(path.join(directory, 'SHA256SUMS'), 'utf8'), checksumAssets.map(asset => `${asset.sha256}  ${asset.name}`).join('\n') + '\n', 'Release checksum manifest does not match');
  const report = fs.readFileSync(path.join(directory, 'BUILD-REPORT.md'), 'utf8');
  assert.ok(report.includes(`Version: ${version}`) && report.includes(`Source commit: ${receipts[0].source}`), 'Build report does not match');
  return [...assets.map(asset => asset.name), 'latest.json', 'SHA256SUMS', 'BUILD-REPORT.md'];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const version = process.env.RELEASE_VERSION;
  assert.equal(readVersions(), version);
  const directory = path.join(repositoryRoot, 'release-assets');
  const source = process.env.GITHUB_SHA;
  const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  if (process.argv[2] === 'merge') console.log(combineAssets({version, directory, source}));
  else console.log(prepareAssets({platform: process.argv[2], version, source, runUrl, directory}));
}
