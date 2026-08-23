import { NotificationItem } from '../models';

/**
 * Resolves the in-app destination for a notification.
 *
 * Missing UUIDs fall back to the module list — never guess a child.
 */
export function notificationDeepLink(n: NotificationItem): string {
  const payload = resolvePayload(n);
  const student = asUuid(payload['studentPublicUuid']);
  const task = asUuid(payload['taskPublicUuid']);
  const invoice = asUuid(payload['invoicePublicUuid']);

  switch (n.category) {
    case 'ABSENCE':
      return student ? `/family/children/${student}/attendance` : '/family';
    case 'TASK':
      return task ? `/lms/assignments/${task}/submit` : '/lms';
    case 'GRADE':
      return '/me/grades';
    case 'PAYMENT':
      return invoice ? `/payments/invoices/${invoice}` : '/payments/invoices';
    default:
      return '/notifications';
  }
}

export function resolvePayload(n: NotificationItem): Record<string, unknown> {
  if (n.payload && Object.keys(n.payload).length > 0) {
    return n.payload;
  }
  try {
    const parsed = JSON.parse(n.bodyHtml ?? '{}') as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* bodyHtml is rendered HTML, not JSON */
  }
  return {};
}

function asUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
