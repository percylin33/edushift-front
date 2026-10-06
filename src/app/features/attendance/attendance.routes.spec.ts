import { ATTENDANCE_ROUTES } from './attendance.routes';

describe('ATTENDANCE_ROUTES', () => {
  it('define rutas esperadas', () => {
    const paths = ATTENDANCE_ROUTES.map((r) => r.path);
    expect(paths).toContain('');
    expect(paths).toContain('scanner');
    expect(paths).toContain('hub');
    expect(paths).toContain('sessions');
    expect(paths).toContain('sessions/:uuid');
  });

  it('path vacío redirige al escáner (flujo puerta)', () => {
    const home = ATTENDANCE_ROUTES.find((r) => r.path === '')!;
    expect(home.redirectTo).toBe('scanner');
    expect(home.pathMatch).toBe('full');
  });

  it('scanner, hub, sessions y sessions/:uuid usan roleGuard', () => {
    for (const p of ['scanner', 'hub', 'sessions', 'sessions/:uuid']) {
      const r = ATTENDANCE_ROUTES.find((x) => x.path === p)!;
      expect(r.canActivate).toBeDefined();
      expect(typeof r.loadComponent).toBe('function');
    }
  });
});
