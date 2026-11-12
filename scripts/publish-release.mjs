import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {git, parseVersion, repositoryRoot, syncVersion, versionFiles} from './release-version.mjs';
import {verifyAssets} from './release-assets.mjs';
import {generateReleaseNotes} from './release-notes.mjs';

const run = (command, args) => execFileSync(command, args, {cwd: repositoryRoot, encoding: 'utf8'}).trim();

function publish(version) {
  parseVersion(version);
  const source = process.env.GITHUB_SHA;
  const runId = process.env.GITHUB_RUN_ID;
  const repository = process.env.GITHUB_REPOSITORY;
  const bump = process.env.VERSION_BUMP || 'patch';
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Only main can publish');
  assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch', 'Releases can only be started manually');
  assert.match(source, /^[a-f0-9]{40}$/);
  assert.match(runId, /^\d+$/);
  assert.match(repository, /^[\w.-]+\/[\w.-]+$/);
  assert.ok(['patch', 'minor', 'major'].includes(bump));
  const assetsDirectory = path.join(repositoryRoot, 'release-assets');
  const assetNames = verifyAssets(version, assetsDirectory, source);
  const tag = `v${version}`;
  const complete = () => {
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'published=true\n');
  };
  const summary = message => {
    console.log(message);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, message + '\n');
  };

  git(['fetch', 'origin', 'main', '--tags']);
  const tags = git(['tag', '--list']).split('\n');
  syncVersion(version);
  if (tags.includes(tag)) {
    const message = git(['log', '-1', '--format=%B', tag]).split('\n');
    assert.ok(message.includes(`Release-Run: ${runId}`) && message.includes(`Release-Source: ${source}`) && message.includes(`Release-Bump: ${bump}`), 'Existing tag belongs to another release; refusing to overwrite it');
    for (const name of versionFiles) {
      assert.equal(git(['show', `${tag}:${name}`]).replaceAll('\r', ''), fs.readFileSync(path.join(repositoryRoot, name), 'utf8').trim().replaceAll('\r', ''), `Retry files differ from ${tag}: ${name}`);
    }
  } else {
    if (git(['rev-parse', 'origin/main']) !== source) {
      summary('Main has advanced. This snapshot passed checks but will not be published; the newer main run will publish.');
      return;
    }
    assert.equal(git(['rev-parse', 'HEAD']), source);
    git(['config', 'user.name', 'github-actions[bot]']);
    git(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
    git(['add', '--', ...versionFiles]);
    git(['commit', '-m', `chore(release): ${tag}`, '-m', `Release-Source: ${source}\nRelease-Run: ${runId}\nRelease-Bump: ${bump}`]);
    git(['tag', '-a', tag, '-m', `Anatolume ${tag}`]);
    // An atomic, non-force push prevents a version commit without its tag and
    // refuses to replace any main update that arrived while we were building.
    git(['push', '--atomic', 'origin', 'HEAD:refs/heads/main', `refs/tags/${tag}`]);
  }

  const view = spawnSync('gh', ['release', 'view', tag, '--repo', repository, '--json', 'isDraft,url,assets'], {encoding: 'utf8'});
  let release;
  if (view.status === 0) release = JSON.parse(view.stdout);
  else if (!/release not found|HTTP 404/i.test(view.stderr)) throw new Error(view.stderr || 'Unable to inspect release');
  if (release && !release.isDraft) {
    const names = new Set(release.assets.map(asset => asset.name));
    assert.ok(assetNames.every(name => names.has(name)), 'Published release is missing expected assets');
    complete();
    summary(`Release already complete: ${release.url}`);
    return;
  }
  const notes = path.join(assetsDirectory, 'RELEASE-NOTES.md');
  fs.writeFileSync(notes, generateReleaseNotes({version, source, repository}));
  if (!release) {
    run('gh', ['release', 'create', tag, '--repo', repository, '--verify-tag', '--draft', '--title', `Anatolume ${tag}`,
      '--notes-file', notes, ...(parseVersion(version)[0] === 0 ? ['--prerelease', '--latest=false'] : ['--latest'])]);
  } else run('gh', ['release', 'edit', tag, '--repo', repository, '--notes-file', notes]);
  run('gh', ['release', 'upload', tag, '--repo', repository, ...assetNames.map(name => path.join(assetsDirectory, name)), '--clobber']);
  const uploaded = JSON.parse(run('gh', ['release', 'view', tag, '--repo', repository, '--json', 'assets']));
  const uploadedNames = new Set(uploaded.assets.map(asset => asset.name));
  assert.ok(assetNames.every(name => uploadedNames.has(name)), 'Uploaded asset names differ from the checksum file');
  run('gh', ['release', 'edit', tag, '--repo', repository, '--draft=false']);
  complete();
  summary(`Published [Anatolume ${tag}](https://github.com/${repository}/releases/tag/${tag}) with Windows installer/portable, macOS universal, Web, SHA256 and build report.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const version = process.env.RELEASE_VERSION;
  if (process.argv[2] === 'publish') publish(version);
  else throw new Error('Usage: node scripts/publish-release.mjs publish');
}
