import { parseColor, rgbToHsl, hslToRgb, buildPalette, getDocumentRoot } from './color.utils';

describe('parseColor', () => {
  it('parsea hex #rgb', () => {
    expect(parseColor('#f00')).toEqual([255, 0, 0]);
  });

  it('parsea hex #rrggbb', () => {
    expect(parseColor('#ff8800')).toEqual([255, 136, 0]);
  });

  it('parsea rgb(r, g, b)', () => {
    expect(parseColor('rgb(100, 200, 50)')).toEqual([100, 200, 50]);
  });

  it('retorna null para input vacío', () => {
    expect(parseColor('')).toBeNull();
  });

  it('retorna null para null', () => {
    expect(parseColor(null as unknown as string)).toBeNull();
  });

  it('retorna null para formato inválido', () => {
    expect(parseColor('not-a-color')).toBeNull();
  });
});

describe('rgbToHsl', () => {
  it('convierte rojo puro', () => {
    const [h, s, l] = rgbToHsl([255, 0, 0]);
    expect(h).toBe(0);
    expect(s).toBe(1);
    expect(l).toBe(0.5);
  });

  it('convierte negro', () => {
    const [h, s, l] = rgbToHsl([0, 0, 0]);
    expect(l).toBe(0);
  });
});

describe('hslToRgb', () => {
  it('convierte rojo puro', () => {
    const [r, g, b] = hslToRgb(0, 1, 0.5);
    expect(r).toBe(255);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });
});

describe('buildPalette', () => {
  it('genera 11 tonos para un color válido', () => {
    const palette = buildPalette('#3b82f6');
    expect(palette).not.toBeNull();
    expect(Object.keys(palette!).length).toBe(11);
  });

  it('cada tono tiene formato "R G B"', () => {
    const palette = buildPalette('#3b82f6');
    for (const shade of Object.keys(palette!)) {
      expect(palette![shade as keyof typeof palette]).toMatch(/^\d+ \d+ \d+$/);
    }
  });

  it('retorna null para color inválido', () => {
    expect(buildPalette('invalid')).toBeNull();
  });
});

describe('getDocumentRoot', () => {
  it('retorna documentElement en el navegador', () => {
    const root = getDocumentRoot();
    expect(root).toBe(document.documentElement);
  });
});
