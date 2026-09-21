/**
 * Appearance: a paper style (what is printed on the page) and a colour set (the ink).
 * Kai and Isha keep their own colours in every palette, so who-said-what never changes.
 */
export const PAPERS = [
  { id: 'dots', label: 'Dots', hint: 'Dot-grid journal' },
  { id: 'lines', label: 'Lines', hint: 'Ruled notebook' },
  { id: 'grid', label: 'Grid', hint: 'Graph paper' },
] as const;

export const PALETTES = [
  { id: 'blueprint', label: 'Blueprint', ink: '31 42 68', paper: '241 243 239' },
  { id: 'graphite', label: 'Graphite', ink: '38 38 43', paper: '242 242 240' },
  { id: 'forest', label: 'Forest', ink: '28 56 48', paper: '238 243 238' },
  { id: 'plum', label: 'Plum', ink: '58 33 72', paper: '243 240 245' },
  { id: 'night', label: 'Night', ink: '226 230 242', paper: '19 22 33' },
] as const;

/** Colour of the phone's status bar / browser chrome for each palette. */
export const BROWSER_BAR: Record<string, string> = {
  blueprint: '#f1f3ef',
  graphite: '#f2f2f0',
  forest: '#eef3ee',
  plum: '#f3f0f5',
  night: '#131621',
};

export type PaperId = (typeof PAPERS)[number]['id'];
export type PaletteId = (typeof PALETTES)[number]['id'];

export interface Look {
  paper: PaperId;
  palette: PaletteId;
}

export const DEFAULT_LOOK: Look = { paper: 'lines', palette: 'blueprint' };
export const LOOK_COOKIE = 'um-look';

const isPaper = (v: unknown): v is PaperId => PAPERS.some((p) => p.id === v);
const isPalette = (v: unknown): v is PaletteId => PALETTES.some((p) => p.id === v);

/** Accepts anything (database JSON, a cookie) and returns a safe, complete Look. */
export function parseLook(value: unknown): Look {
  const source = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  return {
    paper: isPaper(source.paper) ? source.paper : DEFAULT_LOOK.paper,
    palette: isPalette(source.palette) ? source.palette : DEFAULT_LOOK.palette,
  };
}

export function lookFromCookie(raw: string | undefined): Look {
  const [paper, palette] = (raw ?? '').split('.');
  return parseLook({ paper, palette });
}

export function hasLookPreference(value: unknown): boolean {
  return typeof value === 'object' && value !== null && ('paper' in value || 'palette' in value);
}

/** Applies a look to the page immediately and remembers it on this device (so pages render right the first time). */
export function applyLook(look: Look): void {
  const root = document.documentElement;
  root.dataset.paper = look.paper;
  root.dataset.palette = look.palette;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BROWSER_BAR[look.palette] ?? '#f1f3ef');
  document.cookie = `${LOOK_COOKIE}=${look.paper}.${look.palette}; path=/; max-age=31536000; SameSite=Lax`;
}
