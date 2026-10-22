import {
  isLocalhostOrigin,
  tenantHostnameAlias,
  tenantOriginForSlug,
  tenantUrlForSlug,
} from './tenant-host';

describe('tenant hostname helpers', () => {
  it('removes legacy dashes without changing the canonical slug', () => {
    expect(tenantHostnameAlias(' Virgen-Del-Buen-Paso ')).toBe('virgendelbuenpaso');
  });

  it('builds a school subdomain and keeps the local port', () => {
    expect(tenantOriginForSlug('http://localhost:4201', 'virgen-del-buen-paso')).toBe(
      'http://virgendelbuenpaso.localhost:4201',
    );
    expect(tenantUrlForSlug('http://localhost:4201', 'virgen-del-buen-paso', '/auth/login')).toBe(
      'http://virgendelbuenpaso.localhost:4201/auth/login',
    );
  });

  it('allows numeric labels and leaves non-local origins unchanged', () => {
    expect(tenantHostnameAlias('1-colegio')).toBe('1colegio');
    expect(tenantOriginForSlug('https://schools.example', '1colegio')).toBe('https://schools.example');
    expect(isLocalhostOrigin('http://1colegio.localhost:4201')).toBeTrue();
  });
});
