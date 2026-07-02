import { SETTINGS_ROUTES } from './settings.routes';

describe('SETTINGS_ROUTES', () => {
  it('define una ruta raíz con hijos', () => {
    expect(SETTINGS_ROUTES).toHaveSize(1);
  });

  it('carga SettingsShellComponent lazy con tres sub-rutas (user, security, tenant)', () => {
    const root = SETTINGS_ROUTES.find((r) => r.path === '');
    expect(root).toBeDefined();
    expect(typeof root!.loadComponent).toBe('function');
    const children = (root!.children ?? []) as { path: string }[];
    const childPaths = children.map((c) => c.path);
    expect(childPaths).toEqual(expect.arrayContaining(['', 'security', 'tenant']));
  });

  it('la sub-ruta tenant exige rol TENANT_ADMIN', () => {
    const root = SETTINGS_ROUTES.find((r) => r.path === '');
    const tenantRoute = (root!.children ?? []).find((c) => c.path === 'tenant') as {
      canActivate?: ((...args: unknown[]) => unknown)[];
      data?: { roles?: string[] };
    };
    expect(tenantRoute?.canActivate).toBeDefined();
    expect(tenantRoute?.data?.roles).toContain('TENANT_ADMIN');
  });
});
