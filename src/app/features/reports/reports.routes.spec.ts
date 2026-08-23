import { REPORTS_ROUTES } from './reports.routes';

describe('REPORTS_ROUTES', () => {
  it('exposes empty / wizard / catalog paths', () => {
    expect(REPORTS_ROUTES.find(r => r.path === '')).toBeDefined();
    expect(REPORTS_ROUTES.find(r => r.path === 'wizard')).toBeDefined();
    expect(REPORTS_ROUTES.find(r => r.path === 'catalog')).toBeDefined();
  });

  it('catalog is admin-only', () => {
    const catalog = REPORTS_ROUTES.find(r => r.path === 'catalog');
    expect(catalog?.data?.['roles']).toEqual(['TENANT_ADMIN']);
  });

  it('home + wizard are open to admin + teacher + staff', () => {
    const expected = ['TENANT_ADMIN', 'TEACHER', 'STAFF'];
    const home = REPORTS_ROUTES.find(r => r.path === '');
    const wizard = REPORTS_ROUTES.find(r => r.path === 'wizard');
    expect(home?.data?.['roles']).toEqual(expected);
    expect(wizard?.data?.['roles']).toEqual(expected);
  });
});
