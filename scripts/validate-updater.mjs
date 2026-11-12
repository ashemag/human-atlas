import assert from 'node:assert/strict';
import fs from 'node:fs';
import {UpdateController} from '../client/updates/controller.ts';

let checkCalls = 0;
let installCalls = 0;
let finishCheck;
let fail = '';
let restartCalls = 0;
const update = {version: '1.2.3', notes: '• 修复模型选择'};
const controller = new UpdateController({
  check: () => { checkCalls++; return new Promise((resolve, reject) => { finishCheck = fail === 'check' ? () => reject(Error('offline')) : value => resolve(value); }); },
  install: async progress => {
    installCalls++;
    progress({event: 'download', downloaded: 30, total: 100});
    assert.equal(controller.snapshot().downloaded, 30);
    if (fail === 'download') throw Error('signature mismatch');
    progress({event: 'download', downloaded: 100, total: 100});
    progress({event: 'installing'});
    if (fail === 'install') throw Error('read-only directory');
  },
  restart: async () => { restartCalls++; if (fail === 'restart') throw Error('restart failed'); },
});
const statuses = [];
const unsubscribe = controller.subscribe(() => statuses.push(controller.snapshot().status));
await controller.install();
await controller.restart();
assert.equal(installCalls + restartCalls, 0, 'No update or premature restart must do nothing');
let checking = controller.check();
await controller.check();
await controller.install();
assert.equal(checkCalls, 1, 'Concurrent checks must share one request');
finishCheck(null);
await checking;
assert.equal(controller.snapshot().status, 'current');
fail = 'check';
checking = controller.check();
finishCheck();
await checking;
assert.equal(controller.snapshot().error, 'check');
fail = '';
checking = controller.check();
finishCheck(update);
await checking;
assert.equal(controller.snapshot().status, 'available');
for (const failure of ['download', 'install']) {
  fail = failure;
  await controller.install();
  assert.equal(controller.snapshot().error, failure);
  assert.deepEqual(controller.snapshot().update, update, 'Retry must retain the checked update');
}
fail = '';
const installing = controller.install();
await controller.install();
await installing;
assert.equal(installCalls, 3, 'Repeated clicks during an update must not start another install');
assert.equal(controller.snapshot().status, 'ready');
await controller.check();
assert.equal(checkCalls, 3, 'A completed install cannot be replaced before restart');
fail = 'restart';
await controller.restart();
assert.equal(controller.snapshot().error, 'restart');
assert.equal(controller.snapshot().status, 'ready', 'Restart failure must keep the restart action available');
fail = '';
await controller.restart();
assert.equal(controller.snapshot().error, null);
assert.ok(statuses.includes('downloading') && statuses.includes('installing'));
unsubscribe();

const config = JSON.parse(fs.readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
assert.equal(config.bundle.createUpdaterArtifacts, true);
assert.equal(config.plugins.updater.requireSignedVersion, true);
assert.deepEqual(config.plugins.updater.endpoints, ['https://github.com/isunky/Anatolume/releases/latest/download/latest.json']);
assert.match(Buffer.from(config.plugins.updater.pubkey, 'base64').toString(), /untrusted comment:.*public key/);
const capabilities = JSON.parse(fs.readFileSync(new URL('../src-tauri/capabilities/main.json', import.meta.url), 'utf8'));
for (const name of ['allow-check-update', 'allow-install-update', 'allow-restart-updated-app']) assert.ok(capabilities.permissions.includes(name));
assert.ok(!capabilities.permissions.includes('updater:default'), 'The frontend cannot supply arbitrary updater targets or keys');
console.log('Verified update detection, concurrent actions, download/install/restart retries, signed-version policy and fixed endpoint.');
