import { HELP_ROUTES } from './help.routes';

describe('HELP_ROUTES', () => {
  const flat = HELP_ROUTES[0].children || [];

  it('mounts the Family UAT hub at the empty path', () => {
    const root = flat.find((r) => r.path === '');
    expect(root).toBeDefined();
    expect(root?.pathMatch).toBe('full');
    expect(root?.loadComponent).toBeDefined();
  });

  it('exposes script, lead and reports paths', () => {
    expect(flat.find((r) => r.path === 'script/:roleKey')).toBeDefined();
    expect(flat.find((r) => r.path === 'lead')).toBeDefined();
    expect(flat.find((r) => r.path === 'reports')).toBeDefined();
  });

  it('redirects legacy capability / guides / pilot / manuals paths to hub', () => {
    const redirects = flat.filter((r) => r.redirectTo === '');
    const paths = redirects.map((r) => r.path);
    expect(paths).toContain('role/:roleKey');
    expect(paths).toContain('role/:roleKey/:capId');
    expect(paths).toContain('pilot-guide');
    expect(paths).toContain('guides');
    expect(paths).toContain('guides/:roleKey');
    expect(paths).toContain('legacy');
    expect(paths).toContain('legacy/:role');
    expect(paths).toContain('legacy/:role/:chapter');
  });

  it('requires authChildGuard on the root', () => {
    expect(HELP_ROUTES[0].canActivateChild).toBeDefined();
  });
});
