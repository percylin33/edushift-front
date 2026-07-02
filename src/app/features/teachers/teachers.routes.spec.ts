import { TEACHERS_ROUTES } from './teachers.routes';

describe('TEACHERS_ROUTES', () => {
  it('define rutas esperadas', () => {
    const paths = TEACHERS_ROUTES.map((r) => r.path);
    expect(paths).toContain('');
    expect(paths).toContain('new');
    expect(paths).toContain(':id');
    expect(paths).toContain(':id/edit');
  });

  it('cada ruta declara canActivate', () => {
    for (const r of TEACHERS_ROUTES) {
      expect(r.canActivate).toBeDefined();
    }
  });

  it('ruta raíz carga TeachersListComponent', () => {
    const root = TEACHERS_ROUTES.find((r) => r.path === '');
    expect(typeof root!.loadComponent).toBe('function');
  });

  it('rutas new y edit usan el mismo TeacherFormComponent', () => {
    const newRoute = TEACHERS_ROUTES.find((r) => r.path === 'new');
    const editRoute = TEACHERS_ROUTES.find((r) => r.path === ':id/edit');
    expect(newRoute!.loadComponent).toBeDefined();
    expect(editRoute!.loadComponent).toBeDefined();
  });
});
