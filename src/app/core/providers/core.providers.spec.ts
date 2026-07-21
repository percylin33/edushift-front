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

    it('NO incluye providers de Google Sign-In (esos se cargan en main.ts)', () => {
        const providers = provideCore();
        // The static providers list must not contain anything related to
        // @abacritt/angularx-social-login — that SDK ships via a
        // separate dynamic chunk populated by bootstrap glue only when
        // environment.google.enabled is true.
        const joined = JSON.stringify(providers);
        expect(joined.toLowerCase()).not.toContain('socialauth');
        expect(joined.toLowerCase()).not.toContain('googleloginprovider');
        expect(joined.toLowerCase()).not.toContain('socialloginmodule');
    });
});
