import { NotificationItem } from './notification.model';

describe('NotificationItem', () => {
  const base = {
    publicUuid: 'p-1',
    tenantId: 'tenant-1',
    templateKey: 'TEACHER_ASSIGNED',
    category: 'SYSTEM' as const,
    channel: 'BOTH' as const,
    status: 'SENT' as const,
    subject: 'Has sido asignado(a) — A',
    bodyHtml: '{"courseCode":"MAT","sectionName":"A"}',
    sentAt: '2026-01-01T10:00:00Z',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  it('crea una notificación sin leer', () => {
    const n: NotificationItem = { ...base, id: 'n1', readAt: undefined };
    expect(n.status).toBe('SENT');
    expect(n.readAt).toBeUndefined();
  });

  it('crea una notificación leída', () => {
    const n: NotificationItem = {
      ...base,
      id: 'n2',
      status: 'READ',
      readAt: '2026-01-02T10:00:00Z',
    };
    expect(n.status).toBe('READ');
    expect(n.readAt).toBeDefined();
  });

  it('permite metadata opcional', () => {
    const n: NotificationItem = {
      ...base,
      id: 'n3',
      metadata: { key: 'value' },
    };
    expect(n.metadata).toEqual({ key: 'value' });
  });
});
