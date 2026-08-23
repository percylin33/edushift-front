import { notificationDeepLink, resolvePayload } from './notification-deep-link';
import { NotificationItem } from '../models';

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'row-1',
    tenantId: 'tenant-1',
    publicUuid: 'p-1',
    templateKey: 'STUDENT_ABSENT',
    category: 'ABSENCE',
    channel: 'BOTH',
    status: 'SENT',
    subject: 'Falta',
    bodyHtml: '',
    sentAt: '2026-08-18T10:00:00Z',
    createdAt: '2026-08-18T10:00:00Z',
    updatedAt: '2026-08-18T10:00:00Z',
    payload: {},
    ...overrides,
  };
}

describe('notificationDeepLink', () => {
  it('ABSENCE con studentPublicUuid va a asistencia del hijo', () => {
    expect(
      notificationDeepLink(
        item({ payload: { studentPublicUuid: 'st-1' } }),
      ),
    ).toBe('/family/children/st-1/attendance');
  });

  it('ABSENCE sin UUID va a la lista de familia', () => {
    expect(notificationDeepLink(item())).toBe('/family');
  });

  it('TASK con taskPublicUuid va al submit', () => {
    expect(
      notificationDeepLink(
        item({
          category: 'TASK',
          payload: { taskPublicUuid: 'task-1' },
        }),
      ),
    ).toBe('/lms/assignments/task-1/submit');
  });

  it('GRADE va a /me/grades', () => {
    expect(notificationDeepLink(item({ category: 'GRADE' }))).toBe('/me/grades');
  });

  it('PAYMENT con invoice va al detalle', () => {
    expect(
      notificationDeepLink(
        item({
          category: 'PAYMENT',
          payload: { invoicePublicUuid: 'inv-1' },
        }),
      ),
    ).toBe('/payments/invoices/inv-1');
  });

  it('lee UUIDs del bodyHtml JSON si no hay payload', () => {
    expect(
      notificationDeepLink(
        item({
          category: 'PAYMENT',
          payload: {},
          bodyHtml: '{"invoicePublicUuid":"inv-json"}',
        }),
      ),
    ).toBe('/payments/invoices/inv-json');
  });

  it('resolvePayload prefiere el mapa del BE', () => {
    expect(
      resolvePayload(
        item({
          payload: { studentPublicUuid: 'st-1' },
          bodyHtml: '{"studentPublicUuid":"other"}',
        }),
      )['studentPublicUuid'],
    ).toBe('st-1');
  });
});
