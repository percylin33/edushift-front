import { provideCore } from './core.providers';

describe('provideCore', () => {
  it('retorna un array de providers', () => {
    const providers = provideCore();
    expect(Array.isArray(providers)).toBeTrue();
    expect(providers.length).toBeGreaterThan(0);
  });

  it('incluye proveedores HTTP', () => {
    const providers = provideCore();
    expect(providers.some((p) => p && typeof p === 'object')).toBeTrue();
  });
});
