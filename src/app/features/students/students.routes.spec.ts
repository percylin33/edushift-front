import { STUDENTS_ROUTES } from './students.routes';

describe('STUDENTS_ROUTES', () => {
  it('define rutas esperadas', () => {
    const paths = STUDENTS_ROUTES.map((r) => r.path);
    expect(paths).toContain('');
    expect(paths).toContain('new');
    expect(paths).toContain(':id');
    expect(paths).toContain(':id/edit');
    expect(paths).toContain(':id/qr');
  });

  it('cada ruta declara canActivate roleGuard', () => {
    for (const r of STUDENTS_ROUTES) {
      expect(r.canActivate).toBeDefined();
      expect(r.canActivate!.length).toBeGreaterThan(0);
    }
  });

  it('ruta raíz usa StudentsListComponent (lazy)', () => {
    const root = STUDENTS_ROUTES.find((r) => r.path === '');
    expect(root).toBeDefined();
    expect(typeof root!.loadComponent).toBe('function');
  });

  it('ruta new y edit usan el mismo StudentFormComponent', () => {
    const newRoute = STUDENTS_ROUTES.find((r) => r.path === 'new');
    const editRoute = STUDENTS_ROUTES.find((r) => r.path === ':id/edit');
    expect(newRoute!.loadComponent).toBeDefined();
    expect(editRoute!.loadComponent).toBeDefined();
  });

  it('ruta :id/qr permite Teacher y TenantAdmin', () => {
    const qr = STUDENTS_ROUTES.find((r) => r.path === ':id/qr')!;
    expect(qr.data).toBeDefined();
  });
});
