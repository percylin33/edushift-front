import { HELP_ROUTES } from './help.routes';

describe('HELP_ROUTES', () => {
  const flat = HELP_ROUTES[0].children || [];

  it('mounts the QA overview at the empty path', () => {
    const root = flat.find(r => r.path === '');
    expect(root).toBeDefined();
    expect(root?.pathMatch).toBe('full');
    expect(root?.loadComponent).toBeDefined();
  });

  it('exposes role / role-cap / reports paths', () => {
    expect(flat.find(r => r.path === 'role/:roleKey')).toBeDefined();
    expect(flat.find(r => r.path === 'role/:roleKey/:capId')).toBeDefined();
    expect(flat.find(r => r.path === 'reports')).toBeDefined();
  });

  it('exposes pilot-guide, guides and legacy paths', () => {
    expect(flat.find(r => r.path === 'pilot-guide')).toBeDefined();
    expect(flat.find(r => r.path === 'guides')).toBeDefined();
    expect(flat.find(r => r.path === 'guides/:roleKey')).toBeDefined();
    expect(flat.find(r => r.path === 'legacy')).toBeDefined();
    expect(flat.find(r => r.path === 'legacy/:role')).toBeDefined();
    expect(flat.find(r => r.path === 'legacy/:role/:chapter')).toBeDefined();
  });

  it('requires authChildGuard on the root', () => {
    expect(HELP_ROUTES[0].canActivateChild).toBeDefined();
  });
});
