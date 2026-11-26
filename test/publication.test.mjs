import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const meta = JSON.parse(await readFile(join(root, 'port.json'), 'utf8'));
const guide = await readFile(join(root, 'README.md'), 'utf8');
const installation = guide.split('## Installation\n')[1].split('\n## Flavors')[0];
const block = installation.match(/```sh\n([\s\S]*?)\n```/)?.[1];
const recipe = JSON.parse(await readFile(join(root, 'capture/install.json'), 'utf8'));

test('all four flavors have current, integrity-checked native 2560×1600 captures', async () => {
  const result = spawnSync('python3', ['scripts/capture.py', '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  assert.deepEqual(meta.images.map(image => image.flavor), meta.flavors);
  for (const image of meta.images) {
    const bytes = await readFile(join(root, image.path));
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [2560, 1600]);
  }
});

test('installation is direct, flavor-selectable and documents native activation/appearance', () => {
  assert.ok(block);
  assert.match(block, /flavor=night/);
  assert.match(block, /curl -fsSL --create-dirs/);
  assert.doesNotMatch(installation, /git clone|\bcd \S|pnpm install|\|\s*(?:ba)?sh/);
  assert.match(installation, /herdr-app do app.theme --name/);
  assert.match(installation, /Appearance/);
  assert.match(installation, /HERDR_APP_HOME/);
});

for (const mode of ['home', 'xdg', 'app-home']) {
  test(`README download preserves config for every flavor using ${mode} paths with spaces`, async t => {
    const sandbox = await mkdtemp(join(tmpdir(), 'lc-herdr-install-'));
    t.after(() => rm(sandbox, { recursive: true, force: true }));
    const home = join(sandbox, 'home with spaces');
    const bin = join(sandbox, 'bin');
    const config = mode === 'home' ? join(home, '.config') : join(home, 'custom xdg');
    const app = mode === 'app-home' ? join(home, 'custom app home') : join(config, 'herdr-app');
    const log = join(sandbox, 'downloads.jsonl');
    await mkdir(bin); await mkdir(home);
    // Only HTTP transport is stubbed. Execute the README's exact shell block.
    await writeFile(join(bin, 'curl'), `#!${process.execPath}
const fs = require('node:fs'), path = require('node:path');
const args = process.argv.slice(2), output = args.indexOf('-o');
if (output < 0) throw new Error('curl needs an explicit destination');
const url = new URL(args.at(-1));
const prefix = '/living-code-theme/herdr-app/main/';
if (url.origin !== 'https://raw.githubusercontent.com' || !url.pathname.startsWith(prefix)) throw new Error('Wrong repository');
const source = url.pathname.slice(prefix.length);
const manifest = JSON.parse(fs.readFileSync(path.join(process.env.PORT_ROOT, 'port.json')));
if (!manifest.files.includes(source)) throw new Error('Unknown payload: ' + source);
const destination = args[output + 1];
if (!path.resolve(destination).startsWith(process.env.HOME + path.sep)) throw new Error('Escaped temporary home');
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.copyFileSync(path.join(process.env.PORT_ROOT, source), destination);
fs.appendFileSync(process.env.INSTALL_LOG, JSON.stringify({ source, destination }) + '\\n');
`, { mode: 0o755 });
    const existing = ['settings.json', 'keys.json', 'layouts/main.json', 'themes/personal.json'].map(p => join(app, p));
    for (const file of existing) {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, 'preserve personal configuration\n');
    }
    const env = { PATH: bin + ':' + process.env.PATH, HOME: home,
      PORT_ROOT: root, INSTALL_LOG: log };
    if (mode !== 'home') env.XDG_CONFIG_HOME = config;
    if (mode === 'app-home') env.HERDR_APP_HOME = app;
    for (const flavor of meta.flavors) {
      await writeFile(log, '');
      execFileSync('sh', ['-eu', '-c', block.replace('flavor=night', `flavor=${flavor}`)], { env });
      const actual = (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
      const expand = text => text.replace(/\{(app|flavor)\}/g, (_, key) => ({ app, flavor })[key]);
      assert.deepEqual(actual, recipe.downloads.map(item => ({ source: expand(item.source), destination: expand(item.destination) })));
      for (const item of actual) assert.deepEqual(await readFile(item.destination), await readFile(join(root, item.source)));
      for (const file of existing) assert.equal(await readFile(file, 'utf8'), 'preserve personal configuration\n');
    }
  });
}
