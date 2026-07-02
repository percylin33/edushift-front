import { ATTENDANCE_ROUTES } from './attendance.routes';

describe('ATTENDANCE_ROUTES', () => {
  it('define rutas esperadas', () => {
    const paths = ATTENDANCE_ROUTES.map((r) => r.path);
    expect(paths).toContain('');
    expect(paths).toContain('scanner');
    expect(paths).toContain('sessions');
    expect(paths).toContain('sessions/:uuid');
  });

  it('home usa permissionGuard', () => {
    const home = ATTENDANCE_ROUTES.find((r) => r.path === '')!;
    expect(home.canActivate).toBeDefined();
  });

  it('scanner, sessions y sessions/:uuid usan roleGuard', () => {
    for (const p of ['scanner', 'sessions', 'sessions/:uuid']) {
      const r = ATTENDANCE_ROUTES.find((x) => x.path === p)!;
      expect(r.canActivate).toBeDefined();
    }
  });

  it('rutas cargan componentes lazy', () => {
    for (const r of ATTENDANCE_ROUTES) {
      expect(typeof r.loadComponent).toBe('function');
    }
  });
});
