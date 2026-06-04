import { BaseEntity } from '@core/models';

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface NotificationItem extends BaseEntity {
  channel: NotificationChannel;
  severity: NotificationSeverity;
  title: string;
  body: string;
  readAt?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationPreferences {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
  digestFrequency: 'realtime' | 'daily' | 'weekly' | 'off';
}
