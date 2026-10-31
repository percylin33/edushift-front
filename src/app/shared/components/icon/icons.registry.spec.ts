import { ICONS } from './icons.registry';

describe('ICONS registry', () => {
  it('contiene iconos definidos', () => {
    const keys = Object.keys(ICONS);
    expect(keys.length).toBeGreaterThan(0);
  });

  it('cada icono tiene contenido SVG', () => {
    for (const value of Object.values(ICONS)) {
      expect(value).toBeTruthy();
      expect(value).toMatch(/<(path|circle|rect|line|polyline|polygon)\b/);
    }
  });

  it('incluye iconos comunes', () => {
    expect('home' in ICONS).toBe(true);
    expect('users' in ICONS).toBe(true);
    expect('settings' in ICONS).toBe(true);
    expect('bell' in ICONS).toBe(true);
    expect('sun' in ICONS).toBe(true);
    expect('moon' in ICONS).toBe(true);
  });

  it('los nombres están en kebab-case', () => {
    for (const key of Object.keys(ICONS)) {
      expect(key).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });
});
