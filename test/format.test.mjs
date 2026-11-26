import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { resolveAll } from '../scripts/palette.mjs';
import { keys, hexColors, assertContrast } from './helpers.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/upstream.json', import.meta.url)));
const uiRoles = {
  background: 'bg', terminal_foreground: 'fg', foreground: 'fg', surface: 'bg',
  canvas: 'bgAlt', chrome: 'bgDeep', popover: 'bgAlt', raised: 'lineHighlight',
  hover: 'lineHighlight', selected: 'selection', border: 'border', input: 'border',
  muted: 'fgMuted', dim: 'fgMuted', accent: 'accent', accent_foreground: 'bg',
  solid: 'fg', solid_foreground: 'bg', ring: 'borderActive', selection: 'selection',
  cursor: 'cursor', working: 'warning', blocked: 'error', done: 'success',
  idle: 'fgMuted', unknown: 'fgMuted',
};

for (const f of resolveAll()) test(`${f.name}: native ThemeFile, full UI mapping and 16 ANSI colors`, async () => {
  const theme = JSON.parse(await readFile(new URL(`../themes/${f.slug}.json`, import.meta.url)));
  keys(theme, fixture.fields);
  hexColors(theme);
  assert.equal(theme.background, f.r('bg'));
  assert.equal(theme.foreground, f.r('fg'));
  assert.equal(theme.selection, f.r('selection'));
  assert.equal(theme.cursor, f.r('cursor'));
  assert.deepEqual(theme.ansi, [...f.ansi.normal, ...f.ansi.bright]);
  assert.equal(theme.ansi.length, 16);
  keys(theme.colors, fixture.uiColors);
  for (const [key, role] of Object.entries(uiRoles)) assert.equal(theme.colors[key], f.r(role), key);
  assertContrast(theme.foreground, theme.background);
  assertContrast(theme.foreground, theme.selection);
  for (const surface of ['background', 'surface', 'chrome', 'canvas', 'popover', 'raised', 'selected']) {
    assertContrast(theme.colors.foreground, theme.colors[surface]);
  }
  assertContrast(theme.colors.accent_foreground, theme.colors.accent);
  assertContrast(theme.colors.solid_foreground, theme.colors.solid);
  for (const status of ['working', 'blocked', 'done', 'idle', 'unknown']) {
    assertContrast(theme.colors[status], theme.colors.background);
  }
});

test('the compatibility fixture names an immutable upstream release, not this generator', () => {
  assert.equal(fixture.version, '0.1.11');
  assert.match(fixture.source, /herdrdev\/herdr-app\/[a-f0-9]{40}\/src\/settings\.rs$/);
  assert.match(fixture.sha256, /^[a-f0-9]{64}$/);
});
