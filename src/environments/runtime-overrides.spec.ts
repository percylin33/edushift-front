import { resolveApiUrl } from './runtime-overrides';

describe('resolveApiUrl', () => {
  const productionApiUrl = 'https://app.edushift.pe/api';

  it('uses the same-origin API for the EduShift root, app, and tenant hosts', () => {
    expect(resolveApiUrl(productionApiUrl, 'edushift.pe')).toBe('/api');
    expect(resolveApiUrl(productionApiUrl, 'app.edushift.pe')).toBe('/api');
    expect(resolveApiUrl(productionApiUrl, 'colegio.edushift.pe')).toBe('/api');
  });

  it('keeps the configured fallback for unrelated public hosts', () => {
    expect(resolveApiUrl(productionApiUrl, 'preview.example.net')).toBe(productionApiUrl);
  });

  it('does not treat the former EduChief domain as a production origin', () => {
    expect(resolveApiUrl(productionApiUrl, 'educhief.pe')).toBe(productionApiUrl);
  });
});
