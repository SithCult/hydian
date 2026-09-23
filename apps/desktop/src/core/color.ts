// Perceptual colour math: OKLab / OKLCH (Björn Ottosson, 2020) with sRGB gamut mapping,
// WCAG contrast and OKLab distance. Hex strings are 6 digits without "#", as SWTOR stores them.

export interface Lch {
  l: number; // 0..1
  c: number; // 0..~0.37
  h: number; // degrees
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToLinear(hex: string): [number, number, number] {
  const n = parseInt(hex, 16);
  return [toLinear(((n >> 16) & 255) / 255), toLinear(((n >> 8) & 255) / 255), toLinear((n & 255) / 255)];
}

function linearToOklab([r, g, b]: [number, number, number]): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinear([L, a, b]: [number, number, number]): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const lchToLab = ({ l, c, h }: Lch): [number, number, number] => [
  l,
  c * Math.cos((h * Math.PI) / 180),
  c * Math.sin((h * Math.PI) / 180),
];

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

export const isHex = (v: string) => /^[0-9a-f]{6}$/i.test(v);

export function hexToLch(hex: string): Lch {
  const [l, a, b] = linearToOklab(hexToLinear(hex));
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { l, c: Math.hypot(a, b), h: (h + 360) % 360 };
}

/** Keeps lightness and hue and lowers chroma until the colour fits in sRGB. */
function lchToHex(lch: Lch): string {
  const l = Math.min(1, Math.max(0, lch.l));
  let lo = 0,
    hi = Math.max(0, lch.c);
  if (!inGamut(oklabToLinear(lchToLab({ l, c: hi, h: lch.h })))) {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklabToLinear(lchToLab({ l, c: mid, h: lch.h })))) lo = mid;
      else hi = mid;
    }
    hi = lo;
  }
  return oklabToLinear(lchToLab({ l, c: hi, h: lch.h }))
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, v))))) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
}

/** WCAG 2 relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = hexToLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Euclidean distance in OKLab; about 0.02 is a just-noticeable difference. */
export function distance(a: string, b: string): number {
  const [l1, a1, b1] = linearToOklab(hexToLinear(a));
  const [l2, a2, b2] = linearToOklab(hexToLinear(b));
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Raises lightness until the colour reaches `min` contrast against `bg`. */
export function withContrast(lch: Lch, bg: string, min: number): string {
  let hex = lchToHex(lch);
  for (let l = lch.l; contrast(hex, bg) < min && l < 1; l += 0.01) hex = lchToHex({ ...lch, l });
  return hex;
}
