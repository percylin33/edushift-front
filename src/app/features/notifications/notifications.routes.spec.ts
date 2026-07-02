import { NOTIFICATIONS_ROUTES } from './notifications.routes';

describe('NOTIFICATIONS_ROUTES', () => {
  it('define ruta raíz', () => {
    expect(NOTIFICATIONS_ROUTES.length).toBe(1);
    expect(NOTIFICATIONS_ROUTES[0].path).toBe('');
  });

  it('carga NotificationsHomeComponent', async () => {
    const mod = await (NOTIFICATIONS_ROUTES[0].loadComponent! as () => Promise<any>)();
    expect(mod.NotificationsHomeComponent).toBeDefined();
  });
});
