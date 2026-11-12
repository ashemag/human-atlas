import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const versionFiles = ['package.json', 'package-lock.json', 'src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock'];
export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
export const git = (args, root = repositoryRoot) => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();

export function parseVersion(value) {
  assert.match(value, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, 'Use a numeric major.minor.patch version');
  const parts = value.split('.').map(Number);
  assert.ok(parts.every(n => Number.isSafeInteger(n) && n <= 65535), 'Version components must fit Windows version fields');
  return parts;
}

export function nextVersion(current, bump = 'patch') {
  assert.ok(['patch', 'minor', 'major'].includes(bump), 'Unknown version bump');
  const parts = parseVersion(current);
  const index = {major: 0, minor: 1, patch: 2}[bump];
  parts[index]++;
  for (let i = index + 1; i < 3; i++) parts[i] = 0;
  const version = parts.join('.');
  parseVersion(version);
  return version;
}

const cargoPackage = /(^\[package\]\r?\n(?:(?!\r?\n\[)[\s\S])*?^version\s*=\s*")([^"]+)(")/m;
const cargoLockedPackage = /(\[\[package\]\]\r?\nname = "anatolume"\r?\nversion = ")([^"]+)(")/;

export function readVersions(root = repositoryRoot) {
  const read = name => fs.readFileSync(path.join(root, name), 'utf8');
  const manifest = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  const versions = [manifest.version, lock.version, lock.packages[''].version,
    JSON.parse(read('src-tauri/tauri.conf.json')).version,
    read('src-tauri/Cargo.toml').match(cargoPackage)?.[2],
    read('src-tauri/Cargo.lock').match(cargoLockedPackage)?.[2]];
  parseVersion(manifest.version);
  assert.ok(versions.every(v => v === manifest.version), `Version files disagree: ${versions.join(', ')}`);
  return manifest.version;
}

export function syncVersion(version, root = repositoryRoot) {
  parseVersion(version);
  readVersions(root);
  const changes = versionFiles.map(name => {
    const file = path.join(root, name);
    const source = fs.readFileSync(file, 'utf8');
    let updated;
    if (name === 'package.json' || name === 'package-lock.json') {
      const data = JSON.parse(source);
      data.version = version;
      if (name === 'package-lock.json') data.packages[''].version = version;
      updated = JSON.stringify(data, null, 2) + '\n';
    } else if (name.endsWith('.json')) {
      updated = source.replace(/("version"\s*:\s*")[^"]+("),/, (_, a, b) => a + version + b + ',');
    } else {
      const expression = name.endsWith('.toml') ? cargoPackage : cargoLockedPackage;
      assert.ok(expression.test(source), `Package version missing in ${name}`);
      updated = source.replace(expression, (_, a, _old, b) => a + version + b);
    }
    return [file, updated];
  });
  for (const [file, content] of changes) fs.writeFileSync(file, content);
  assert.equal(readVersions(root), version);
}

const compare = (a, b) => {
  const left = parseVersion(a), right = parseVersion(b);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] - right[i];
  return 0;
};

export function releasePlan({enabled = false, bump = 'patch', runId = '', source = '', root = repositoryRoot} = {}) {
  const current = readVersions(root);
  if (!enabled) return {version: current, tag: `v${current}`, release: false, prerelease: parseVersion(current)[0] === 0};
  assert.ok(['patch', 'minor', 'major'].includes(bump), 'Unknown version bump');
  const tags = git(['tag', '--list'], root).split('\n').filter(t => /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(t));
  for (const tag of tags) {
    const message = git(['log', '-1', '--format=%B', tag], root);
    if (runId && message.split('\n').includes(`Release-Run: ${runId}`)) {
      assert.ok(message.split('\n').includes(`Release-Source: ${source}`), 'Retry source does not match the existing tag');
      assert.ok(message.split('\n').includes(`Release-Bump: ${bump}`), 'Retry bump does not match the existing tag');
      return {version: tag.slice(1), tag, release: true, prerelease: parseVersion(tag.slice(1))[0] === 0};
    }
  }
  const base = tags.map(t => t.slice(1)).reduce((latest, v) => compare(v, latest) > 0 ? v : latest, current);
  const version = nextVersion(base, bump);
  return {version, tag: `v${version}`, release: true, prerelease: parseVersion(version)[0] === 0};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, version] = process.argv.slice(2);
  if (command === 'sync') {
    syncVersion(version);
    console.log(`Synchronized npm, Tauri and Rust to ${version}`);
  } else if (command === 'plan') {
    const plan = releasePlan({enabled: process.env.RELEASE_ENABLED === 'true', bump: process.env.VERSION_BUMP || 'patch',
      runId: process.env.GITHUB_RUN_ID, source: process.env.GITHUB_SHA});
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(plan).map(([key, value]) => `${key}=${value}\n`).join(''));
    console.log(JSON.stringify(plan, null, 2));
  } else {
    throw new Error('Usage: node scripts/release-version.mjs plan | sync <version>');
  }
}
