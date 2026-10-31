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
  const quiz = asUuid(payload['quizPublicUuid']);
  const invoice = asUuid(payload['invoicePublicUuid']);

  switch (n.category) {
    case 'ABSENCE':
      return student ? `/family/children/${student}/attendance` : '/family';
    case 'TASK':
      return task ? `/lms/assignments/${task}/submit` : '/lms';
    case 'GRADE':
      return '/me/grades';
    case 'QUIZ':
      return quiz ? `/lms/quizzes/${quiz}/take` : '/lms';
    case 'AI_FEEDBACK':
      return task ? `/lms/assignments/${task}/submit` : '/lms';
    case 'PAYMENT':
      return invoice ? `/payments/invoices/${invoice}` : '/payments/invoices';
    case 'ANNOUNCEMENT':
      return '/notifications';
    default:
      return '/notifications';
  }
}

/**
 * Human-readable Spanish title. Prefers the BE-rendered {@code subject};
 * if the BE fell back to a raw template key (`QUIZ_PUBLISHED · …`), rebuild
 * from {@code templateKey} + payload.
 */
export function notificationDisplaySubject(n: NotificationItem): string {
  const subject = (n.subject ?? '').trim();
  if (subject && !looksLikeRawTemplateKey(subject, n.templateKey)) {
    return subject;
  }
  const payload = resolvePayload(n);
  const detail = firstString(payload, [
    'quizTitle',
    'taskTitle',
    'evaluationTitle',
    'title',
    'invoiceNumber',
  ]);
  const base = TEMPLATE_SUBJECT_ES[n.templateKey] ?? 'Notificación';
  return detail ? `${base} — ${detail}` : base;
}

const TEMPLATE_SUBJECT_ES: Record<string, string> = {
  QUIZ_PUBLISHED: 'Nueva práctica disponible',
  GRADE_PUBLISHED: 'Nueva calificación publicada',
  TASK_RETURNED: 'Tu tarea fue devuelta',
  TASK_PUBLISHED: 'Nueva tarea disponible',
  AI_FEEDBACK_READY: 'Retroalimentación disponible',
  STUDENT_ABSENT: 'Ausencia registrada',
  PAYMENT_DUE: 'Pago pendiente',
  ANNOUNCEMENT: 'Anuncio',
  TEACHER_ASSIGNED: 'Nueva asignación académica',
  SECTION_NEW_TEACHER: 'Nuevo docente en tu sección',
  PASSWORD_RESET: 'Restablece tu contraseña',
  WELCOME_TENANT: 'Bienvenido a EduShift',
};

function looksLikeRawTemplateKey(subject: string, templateKey: string | undefined): boolean {
  if (!templateKey) return /^[A-Z][A-Z0-9_]+(\s·\s|$)/.test(subject);
  return subject === templateKey || subject.startsWith(`${templateKey} ·`);
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

function firstString(
  payload: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const v = payload[key];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}
