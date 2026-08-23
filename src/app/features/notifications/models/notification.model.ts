import { BaseEntity } from '@core/models';

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';
export type NotificationStatus = 'PENDING' | 'SENT' | 'READ' | 'FAILED';
export type NotificationCategoryBackend =
  | 'ABSENCE'
  | 'GRADE'
  | 'QUIZ'
  | 'TASK'
  | 'AI_FEEDBACK'
  | 'ANNOUNCEMENT'
  | 'PAYMENT'
  | 'SYSTEM';

/**
 * Backend wire format for {@code NotificationResponse} (BE-9.1, Sprint 9).
 *
 * <p>The FE reuses the same field names the BE serializes — no client-side
 * mapping — so payload changes in the BE are surfaced immediately. The
 * {@link BaseEntity.id} is the backend {@code publicUuid}; the
 * unused-at-FE {@code tenantId / createdAt / updatedAt} are populated
 * but not displayed in the list UI.</p>
 */
export interface NotificationItem extends BaseEntity {
  /** Backend public UUID — same value as {@link BaseEntity.id} but kept as
   *  its own field so the existing bell badge service (which already
   *  uses {@code publicUuid} for markRead) keeps working unchanged. */
  publicUuid: string;
  templateKey: string;
  category: NotificationCategoryBackend;
  channel: 'IN_APP' | 'EMAIL' | 'BOTH' | string;
  status: NotificationStatus;
  /** Pre-formatted "{template} · {sentAt}" line the BE exposes for FE convenience. */
  subject: string;
  /** Rendered payload as a JSON string (not a nested object). Parsed by the page to
   *  derive the human-readable one-line summary. */
  bodyHtml: string;
  sentAt: string;
  readAt?: string;
  /** Bounded event payload (UUIDs for deep links). */
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface NotificationPreferences {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
  digestFrequency: 'realtime' | 'daily' | 'weekly' | 'off';
}
