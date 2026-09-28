// Colour resolution for cell fills (styles.xml) and DrawingML fills.
import { child, children } from './xml';

export type Rgb = string; // "RRGGBB", upper case

export interface Theme {
  /** Scheme colours by DrawingML name: dk1, lt1, dk2, lt2, accent1…6, hlink, folHlink. */
  scheme: Record<string, Rgb>;
}

const DEFAULT_SCHEME: Record<string, Rgb> = {
  dk1: '000000',
  lt1: 'FFFFFF',
  dk2: '44546A',
  lt2: 'E7E6E6',
  accent1: '4472C4',
  accent2: 'ED7D31',
  accent3: 'A5A5A5',
  accent4: 'FFC000',
  accent5: '5B9BD5',
  accent6: '70AD47',
  hlink: '0563C1',
  folHlink: '954F72',
};

export function parseTheme(doc: Document | null): Theme {
  const scheme = { ...DEFAULT_SCHEME };
  const clr = doc?.getElementsByTagNameNS('*', 'clrScheme')[0];
  for (const entry of children(clr)) {
    const value = entry.firstElementChild;
    const rgb =
      value?.localName === 'srgbClr'
        ? value.getAttribute('val')
        : value?.localName === 'sysClr'
          ? value.getAttribute('lastClr')
          : null;
    if (rgb && /^[0-9a-f]{6}$/i.test(rgb)) scheme[entry.localName] = rgb.toUpperCase();
  }
  return { scheme };
}

// Standard legacy palette for `indexed` colours (SpreadsheetML §18.8.27).
const INDEXED: Rgb[] = (
  '000000 FFFFFF FF0000 00FF00 0000FF FFFF00 FF00FF 00FFFF 000000 FFFFFF FF0000 00FF00 0000FF ' +
  'FFFF00 FF00FF 00FFFF 800000 008000 000080 808000 800080 008080 C0C0C0 808080 9999FF 993366 ' +
  'FFFFCC CCFFFF 660066 FF8080 0066CC CCCCFF 000080 FF00FF FFFF00 00FFFF 800080 800000 008080 ' +
  '0000FF 00CCFF CCFFFF CCFFCC FFFF99 99CCFF FF99CC CC99FF FFCC99 3366FF 33CCCC 99CC00 FFCC00 ' +
  'FF9900 FF6600 666699 969696 003366 339966 003300 333300 993300 993366 333399 333333'
).split(' ');

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
const toHex = (r: number, g: number, b: number): Rgb =>
  [r, g, b]
    .map((v) => clamp(v).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
const fromHex = (rgb: Rgb): [number, number, number] => [
  parseInt(rgb.slice(0, 2), 16),
  parseInt(rgb.slice(2, 4), 16),
  parseInt(rgb.slice(4, 6), 16),
];

function rgbToHsl(rgb: Rgb): [number, number, number] {
  const [r, g, b] = fromHex(rgb).map((v) => v / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) / 6
      : max === g
        ? ((b - r) / d + 2) / 6
        : ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) return toHex(l * 255, l * 255, l * 255);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return toHex(hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255);
}

/** SpreadsheetML tint: -1 … 1 applied to luminance. */
export function applyTint(rgb: Rgb, tint: number): Rgb {
  if (!tint) return rgb;
  const [h, s, l] = rgbToHsl(rgb);
  const next = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint;
  return hslToRgb(h, s, next);
}

/** Cell colour element (<fgColor>, <color>) attributes → RGB. */
export function cellColor(attrs: Record<string, string>, theme: Theme): Rgb | null {
  let rgb: Rgb | null = null;
  if (attrs.rgb && /^[0-9a-f]{6,8}$/i.test(attrs.rgb)) rgb = attrs.rgb.slice(-6).toUpperCase();
  else if (attrs.theme != null) {
    // Cell theme indices swap the dark/light pairs compared to DrawingML.
    const order = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4'];
    const more = ['accent5', 'accent6', 'hlink', 'folHlink'];
    const name = [...order, ...more][Number(attrs.theme)];
    rgb = name ? (theme.scheme[name] ?? null) : null;
  } else if (attrs.indexed != null) rgb = INDEXED[Number(attrs.indexed)] ?? null;
  if (rgb && attrs.tint) rgb = applyTint(rgb, Number(attrs.tint));
  return rgb;
}

const SCHEME_ALIAS: Record<string, string> = { tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2' };
const PRESET: Record<string, Rgb> = {
  black: '000000',
  white: 'FFFFFF',
  red: 'FF0000',
  green: '008000',
  blue: '0000FF',
  yellow: 'FFFF00',
  orange: 'FFA500',
  gray: '808080',
  grey: '808080',
  lightGray: 'D3D3D3',
  silver: 'C0C0C0',
};

/** DrawingML colour element (srgbClr, schemeClr, sysClr, prstClr, scrgbClr) → RGB. */
export function drawingColor(el: Element | undefined, theme: Theme): Rgb | null {
  if (!el) return null;
  let rgb: Rgb | null = null;
  const val = el.getAttribute('val') ?? '';
  switch (el.localName) {
    case 'srgbClr':
      rgb = /^[0-9a-f]{6}$/i.test(val) ? val.toUpperCase() : null;
      break;
    case 'sysClr':
      rgb =
        (el.getAttribute('lastClr') ?? '').toUpperCase() ||
        (val === 'window' ? 'FFFFFF' : '000000');
      break;
    case 'schemeClr':
      rgb = theme.scheme[SCHEME_ALIAS[val] ?? val] ?? null;
      break;
    case 'prstClr':
      rgb = PRESET[val] ?? null;
      break;
    case 'scrgbClr': {
      const pct = (name: string) => (Number(el.getAttribute(name) ?? 0) / 100000) * 255;
      rgb = toHex(pct('r'), pct('g'), pct('b'));
      break;
    }
    default:
      rgb = null;
  }
  if (!rgb) return null;
  // Luminance modifiers used by Office for theme-derived colours.
  const mod = (name: string) => child(el, name)?.getAttribute('val');
  const lumMod = mod('lumMod'),
    lumOff = mod('lumOff'),
    tint = mod('tint'),
    shade = mod('shade');
  if (lumMod || lumOff) {
    const [h, s, l] = rgbToHsl(rgb);
    const next = l * (Number(lumMod ?? 100000) / 100000) + Number(lumOff ?? 0) / 100000;
    rgb = hslToRgb(h, s, Math.max(0, Math.min(1, next)));
  }
  if (tint) {
    const t = Number(tint) / 100000;
    rgb = toHex(...(fromHex(rgb).map((v) => v * t + 255 * (1 - t)) as [number, number, number]));
  }
  if (shade) {
    const f = Number(shade) / 100000;
    rgb = toHex(...(fromHex(rgb).map((v) => v * f) as [number, number, number]));
  }
  return rgb;
}

/** Euclidean distance in RGB space (0 … ~441). */
export function colorDistance(a: Rgb, b: Rgb): number {
  const [r1, g1, b1] = fromHex(a),
    [r2, g2, b2] = fromHex(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

/** True for strongly saturated orange-like colours (fallback for "Ltg S2"). */
export function isOrange(rgb: Rgb): boolean {
  const [h, s, l] = rgbToHsl(rgb);
  return h >= 0.04 && h <= 0.12 && s > 0.5 && l > 0.35 && l < 0.85;
}
