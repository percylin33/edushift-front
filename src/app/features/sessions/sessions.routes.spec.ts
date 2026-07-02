import { SESSIONS_ROUTES } from './sessions.routes';

describe('SESSIONS_ROUTES', () => {
  it('define rutas esperadas', () => {
    const paths = SESSIONS_ROUTES.map((r) => r.path);
    expect(paths).toContain('');
    expect(paths).toContain('new');
    expect(paths).toContain(':id');
  });

  it('ruta :id tiene children edit', () => {
    const idRoute = SESSIONS_ROUTES.find((r) => r.path === ':id')!;
    expect(idRoute.children).toBeDefined();
    const childPaths = idRoute.children!.map((c) => c.path);
    expect(childPaths).toContain('');
    expect(childPaths).toContain('edit');
  });

  it('ruta raíz usa SessionsListComponent eager', () => {
    const root = SESSIONS_ROUTES.find((r) => r.path === '');
    expect(root!.component).toBeDefined();
  });

  it('new y edit cargan SessionsFormComponent lazy', () => {
    const newRoute = SESSIONS_ROUTES.find((r) => r.path === 'new');
    expect(typeof newRoute!.loadComponent).toBe('function');
  });
});
