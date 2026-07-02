import { NotificationItem } from './notification.model';

describe('NotificationItem', () => {
  it('crea una notificación con channel in_app', () => {
    const n: NotificationItem = {
      id: 'n1',
      channel: 'in_app',
      severity: 'info',
      title: 'Título',
      body: 'Cuerpo',
      readAt: undefined,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    expect(n.channel).toBe('in_app');
    expect(n.severity).toBe('info');
    expect(n.readAt).toBeUndefined();
  });

  it('crea una notificación leída', () => {
    const n: NotificationItem = {
      id: 'n2',
      channel: 'email',
      severity: 'warning',
      title: 'Alerta',
      body: 'Cuerpo',
      readAt: '2026-01-02T10:00:00Z',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
    };
    expect(n.readAt).toBeDefined();
  });

  it('permite metadata opcional', () => {
    const n: NotificationItem = {
      id: 'n3',
      channel: 'push',
      severity: 'error',
      title: 'Error',
      body: 'Detalle',
      metadata: { key: 'value' },
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    expect(n.metadata).toEqual({ key: 'value' });
  });
});
