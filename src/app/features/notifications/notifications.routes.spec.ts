import { NOTIFICATIONS_ROUTES } from './notifications.routes';

describe('NOTIFICATIONS_ROUTES', () => {
  it('define inicio, preferencias y administración de plantillas', () => {
    expect(NOTIFICATIONS_ROUTES.length).toBe(3);
    expect(NOTIFICATIONS_ROUTES[0].path).toBe('');
    expect(NOTIFICATIONS_ROUTES.map((route) => route.path)).toContain('preferences');
    expect(NOTIFICATIONS_ROUTES.map((route) => route.path)).toContain('templates');
  });

  it('carga NotificationsHomeComponent', async () => {
    const component = await NOTIFICATIONS_ROUTES[0].loadComponent!();
    expect(component).toBeDefined();
  });
});
