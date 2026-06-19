/**
 * Notification preferences model (Sprint 9 / FE-9.4).
 *
 * <p>Mirrors the backend's {@code Notification.Channel} and
 * {@code Notification.Category} enums. The matrix is rendered as
 * rows = categories, columns = channels.</p>
 */
export const NOTIFICATION_CHANNELS = ['IN_APP', 'EMAIL'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_CATEGORIES = [
  'ABSENCE', 'GRADE', 'QUIZ', 'TASK', 'AI_FEEDBACK',
  'ANNOUNCEMENT', 'PAYMENT', 'SYSTEM'
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export interface NotificationPreferenceRow {
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
}
