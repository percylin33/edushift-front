/**
 * Color utilities used by the tenant theming layer.
 *
 * Why we roll our own:
 *   - The whole design system is wired to a `--color-primary-{50..950}` scale
 *     stored as `R G B` triplets (Tailwind opacity modifier pattern).
 *   - Tenants only provide a single brand color; we generate the rest by
 *     interpolating from the brand hue toward white (light steps) or black
 *     (dark steps) using HSL.
 *   - Keeping the math here (and not in a service) lets us unit-test it
 *     independently and reuse from elsewhere (theme picker, preview, etc.).
 */

export type RgbTriplet = readonly [number, number, number];

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type Shade = (typeof SHADES)[number];

const SHADE_LIGHTNESS: Record<Shade, number> = {
  50: 0.97,
  100: 0.94,
  200: 0.86,
  300: 0.75,
  400: 0.62,
  500: 0.5,
  600: 0.42,
  700: 0.34,
  800: 0.27,
  900: 0.2,
  950: 0.12
};

/** Parse `#rgb`, `#rrggbb`, or `rgb(r, g, b)` into an `[r, g, b]` triplet (0-255). */
export function parseColor(input: string): RgbTriplet | null {
  if (!input) return null;
  const value = input.trim().toLowerCase();

  const hexMatch = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    const expanded =
      hex.length === 3
        ? hex.split('').map((c) => c + c).join('')
        : hex;
    return [
      parseInt(expanded.slice(0, 2), 16),
      parseInt(expanded.slice(2, 4), 16),
      parseInt(expanded.slice(4, 6), 16)
    ];
  }

  const rgbMatch = value.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
  }
  return null;
}

export function rgbToHsl([r, g, b]: RgbTriplet): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      default: h = (rn - gn) / d + 4;
    }
    h *= 60;
  }
  return [h, s, l];
}

export function hslToRgb(h: number, s: number, l: number): RgbTriplet {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0, gp = 0, bp = 0;
  if (h < 60)        { rp = c; gp = x; }
  else if (h < 120)  { rp = x; gp = c; }
  else if (h < 180)  { gp = c; bp = x; }
  else if (h < 240)  { gp = x; bp = c; }
  else if (h < 300)  { rp = x; bp = c; }
  else               { rp = c; bp = x; }
  return [Math.round((rp + m) * 255), Math.round((gp + m) * 255), Math.round((bp + m) * 255)];
}

/**
 * Build the full 11-shade scale from a brand color by holding hue/saturation
 * and remapping lightness. Returns an object keyed by shade with `R G B`
 * strings ready to be assigned to a CSS variable.
 */
export function buildPalette(brandColor: string): Record<Shade, string> | null {
  const rgb = parseColor(brandColor);
  if (!rgb) return null;

  const [h, s] = rgbToHsl(rgb);
  const saturation = Math.max(0.25, Math.min(0.95, s));

  const palette = {} as Record<Shade, string>;
  for (const shade of SHADES) {
    const [r, g, b] = hslToRgb(h, saturation, SHADE_LIGHTNESS[shade]);
    palette[shade] = `${r} ${g} ${b}`;
  }
  return palette;
}

/** Cosmetic guard for SSR / unit-test environments. */
export function getDocumentRoot(): HTMLElement | null {
  return typeof document !== 'undefined' ? document.documentElement : null;
}
