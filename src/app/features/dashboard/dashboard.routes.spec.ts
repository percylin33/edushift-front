import { DASHBOARD_ROUTES } from './dashboard.routes';

describe('DASHBOARD_ROUTES', () => {
  it('define ruta raíz', () => {
    expect(DASHBOARD_ROUTES.length).toBe(1);
    expect(DASHBOARD_ROUTES[0].path).toBe('');
  });

  it('carga DashboardHomeComponent', async () => {
    const mod = await (DASHBOARD_ROUTES[0].loadComponent! as () => Promise<any>)();
    expect(mod.DashboardHomeComponent).toBeDefined();
  });
});
