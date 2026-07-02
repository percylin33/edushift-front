import { THEME_TOKENS, PALETTE_SHADES, ALL_TENANT_VARS, paletteVars } from './theme-tokens';

describe('THEME_TOKENS', () => {
  it('primaryPalette tiene 11 variables', () => {
    expect(THEME_TOKENS.primaryPalette.length).toBe(11);
  });

  it('accentPalette tiene 11 variables', () => {
    expect(THEME_TOKENS.accentPalette.length).toBe(11);
  });

  it('radius es --radius-base', () => {
    expect(THEME_TOKENS.radius).toBe('--radius-base');
  });

  it('fontSans es --font-sans', () => {
    expect(THEME_TOKENS.fontSans).toBe('--font-sans');
  });
});

describe('PALETTE_SHADES', () => {
  it('tiene 11 tonos', () => {
    expect(PALETTE_SHADES.length).toBe(11);
  });

  it('incluye 50, 500 y 950', () => {
    expect(PALETTE_SHADES).toContain(50);
    expect(PALETTE_SHADES).toContain(500);
    expect(PALETTE_SHADES).toContain(950);
  });
});

describe('ALL_TENANT_VARS', () => {
  it('incluye todas las variables de tenant', () => {
    const expected = THEME_TOKENS.primaryPalette.length + THEME_TOKENS.accentPalette.length + 2;
    expect(ALL_TENANT_VARS.length).toBe(expected);
  });
});

describe('paletteVars', () => {
  it('genera variables CSS para primary', () => {
    const vars = paletteVars('primary');
    expect(vars[0]).toBe('--color-primary-50');
    expect(vars[10]).toBe('--color-primary-950');
  });

  it('genera variables CSS para accent', () => {
    const vars = paletteVars('accent');
    expect(vars[0]).toBe('--color-accent-50');
  });
});
