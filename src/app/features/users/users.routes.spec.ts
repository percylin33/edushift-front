import { USERS_ROUTES } from './users.routes';

describe('USERS_ROUTES', () => {
  it('define rutas esperadas', () => {
    const paths = USERS_ROUTES.map((r) => r.path);
    expect(paths).toContain('');
    expect(paths).toContain(':id');
  });

  it('cada ruta declara canActivate', () => {
    for (const r of USERS_ROUTES) {
      expect(r.canActivate).toBeDefined();
    }
  });

  it('ruta raíz carga UsersListComponent lazy', () => {
    const root = USERS_ROUTES.find((r) => r.path === '');
    expect(typeof root!.loadComponent).toBe('function');
  });

  it('ruta :id carga UserDetailComponent lazy', () => {
    const detail = USERS_ROUTES.find((r) => r.path === ':id');
    expect(typeof detail!.loadComponent).toBe('function');
  });
});
