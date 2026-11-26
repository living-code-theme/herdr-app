// Herdr App's native ThemeFile palette and every resolved UI color.
// Semantic roles, not literal colors: all four flavors follow the same contract.
export const roles = {
  background: 'bg', terminal_foreground: 'fg', foreground: 'fg',
  surface: 'bg', canvas: 'bgAlt', chrome: 'bgDeep', popover: 'bgAlt',
  raised: 'lineHighlight', hover: 'lineHighlight', selected: 'selection',
  border: 'border', input: 'border', muted: 'fgMuted', dim: 'fgMuted',
  accent: 'accent', accent_foreground: 'bg', solid: 'fg', solid_foreground: 'bg',
  ring: 'borderActive', selection: 'selection', cursor: 'cursor',
  working: 'warning', blocked: 'error', done: 'success', idle: 'fgMuted', unknown: 'fgMuted',
};

export function generate(flavors) {
  return flavors.map(f => ({
    path: `themes/${f.slug}.json`,
    content: JSON.stringify({
      background: f.r('bg'),
      foreground: f.r('fg'),
      selection: f.r('selection'),
      cursor: f.r('cursor'),
      ansi: [...f.ansi.normal, ...f.ansi.bright],
      colors: Object.fromEntries(Object.entries(roles).map(([key, role]) => [key, f.r(role)])),
    }, null, 2) + '\n',
  }));
}
