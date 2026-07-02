import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_CATEGORIES,
  NotificationChannel,
  NotificationCategory,
  NotificationPreferenceRow,
} from './preferences.model';

describe('NOTIFICATION_CHANNELS', () => {
  it('contiene IN_APP y EMAIL', () => {
    expect(NOTIFICATION_CHANNELS).toContain('IN_APP');
    expect(NOTIFICATION_CHANNELS).toContain('EMAIL');
  });
});

describe('NOTIFICATION_CATEGORIES', () => {
  it('contiene todas las categorías', () => {
    expect(NOTIFICATION_CATEGORIES).toContain('ABSENCE');
    expect(NOTIFICATION_CATEGORIES).toContain('GRADE');
    expect(NOTIFICATION_CATEGORIES).toContain('AI_FEEDBACK');
    expect(NOTIFICATION_CATEGORIES).toContain('SYSTEM');
  });
});

describe('NotificationPreferenceRow', () => {
  it('crea fila de preferencia', () => {
    const row: NotificationPreferenceRow = { category: 'GRADE', channel: 'EMAIL', enabled: true };
    expect(row.enabled).toBeTrue();
  });

  it('permite disabled', () => {
    const row: NotificationPreferenceRow = {
      category: 'ABSENCE',
      channel: 'IN_APP',
      enabled: false,
    };
    expect(row.enabled).toBeFalse();
  });
});
