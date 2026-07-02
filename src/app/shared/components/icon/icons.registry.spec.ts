import { ICONS } from './icons.registry';

describe('ICONS registry', () => {
  it('contiene iconos definidos', () => {
    const keys = Object.keys(ICONS);
    expect(keys.length).toBeGreaterThan(0);
  });

  it('cada icono tiene contenido SVG', () => {
    for (const [key, value] of Object.entries(ICONS)) {
      expect(value).toBeTruthy();
      expect(value).toContain('<path');
    }
  });

  it('incluye iconos comunes', () => {
    expect(ICONS).toHaveProperty('home');
    expect(ICONS).toHaveProperty('users');
    expect(ICONS).toHaveProperty('settings');
    expect(ICONS).toHaveProperty('bell');
    expect(ICONS).toHaveProperty('sun');
    expect(ICONS).toHaveProperty('moon');
  });

  it('los nombres están en kebab-case', () => {
    for (const key of Object.keys(ICONS)) {
      expect(key).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });
});
