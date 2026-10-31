import { resolveApiUrl } from './runtime-overrides';

describe('resolveApiUrl', () => {
  const productionApiUrl = 'https://app.educhief.pe/api';

  it('uses the same-origin API for the EduChief root, app, and tenant hosts', () => {
    expect(resolveApiUrl(productionApiUrl, 'educhief.pe')).toBe('/api');
    expect(resolveApiUrl(productionApiUrl, 'app.educhief.pe')).toBe('/api');
    expect(resolveApiUrl(productionApiUrl, 'colegio.educhief.pe')).toBe('/api');
  });

  it('keeps the EduShift host mapping for the production simulation', () => {
    expect(resolveApiUrl(productionApiUrl, 'app.edushift.pe')).toBe('/api');
  });

  it('keeps the configured fallback for unrelated public hosts', () => {
    expect(resolveApiUrl(productionApiUrl, 'preview.example.net')).toBe(productionApiUrl);
  });
});
