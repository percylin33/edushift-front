import { SCHEDULE_ROUTES } from './schedule.routes';

describe('SCHEDULE_ROUTES', () => {
  it('exposes section, personal, jornada, jornada detail and workload routes', () => {
    expect(SCHEDULE_ROUTES.length).toBe(5);
    const root = SCHEDULE_ROUTES.find((r) => r.path === '');
    const me = SCHEDULE_ROUTES.find((r) => r.path === 'me');
    const jornada = SCHEDULE_ROUTES.find((r) => r.path === 'jornada');
    const jornadaDetail = SCHEDULE_ROUTES.find((r) => r.path === 'jornada/:templateUuid');
    const workload = SCHEDULE_ROUTES.find((r) => r.path === 'workload');
    expect(root).toBeDefined();
    expect(me).toBeDefined();
    expect(jornada).toBeDefined();
    expect(jornadaDetail).toBeDefined();
    expect(workload).toBeDefined();
    expect(root?.loadComponent).toBeDefined();
    expect(me?.loadComponent).toBeDefined();
    expect(jornada?.loadComponent).toBeDefined();
    expect(jornadaDetail?.loadComponent).toBeDefined();
    expect(workload?.loadComponent).toBeDefined();
  });

  it('root path is pathMatch:full', () => {
    const root = SCHEDULE_ROUTES.find((r) => r.path === '');
    expect(root?.pathMatch).toBe('full');
  });

  it('jornada, jornada detail and workload require TENANT_ADMIN', () => {
    const jornada = SCHEDULE_ROUTES.find((r) => r.path === 'jornada');
    const jornadaDetail = SCHEDULE_ROUTES.find((r) => r.path === 'jornada/:templateUuid');
    const workload = SCHEDULE_ROUTES.find((r) => r.path === 'workload');
    expect(jornada?.canActivate).toBeDefined();
    expect(jornadaDetail?.canActivate).toBeDefined();
    expect(workload?.canActivate).toBeDefined();
    expect(jornada?.data?.['roles']).toContain('TENANT_ADMIN');
    expect(jornadaDetail?.data?.['roles']).toContain('TENANT_ADMIN');
    expect(workload?.data?.['roles']).toContain('TENANT_ADMIN');
  });
});
