import { createHmac, randomUUID } from 'node:crypto';

/**
 * MercadoPago webhook mock — signs payloads with the configured HMAC
 * so the BE's {@code POST /v1/webhooks/mercadopago} accepts the
 * notification.
 *
 * <p>The EduShift BE verifies the signature by reading the
 * {@code x-signature} header of the form
 * {@code "ts=<unix>,v1=<hex-hmac>"}. The HMAC body is
 * {@code "id=<data.id>;<request.id>;<ts>"}. See
 * {@code com.edushift.modules.payments.controller.MercadoPagoWebhookController}
 * for the canonical verification code.</p>
 */

const DEFAULT_SECRET = 'test-webhook-secret';

/** Signs a webhook payload the way MercadoPago does. */
export function signMercadoPago(
  dataId: string,
  requestId: string,
  timestamp: number,
  secret: string = DEFAULT_SECRET,
): string {
  const template = `id=${dataId};request-id=${requestId};ts=${timestamp};`;
  return createHmac('sha256', secret).update(template).digest('hex');
}

/**
 * Build the {@code x-signature} header value MercadoPago expects.
 */
export function buildSignatureHeader(
  dataId: string,
  requestId: string,
  timestamp: number,
  secret?: string,
): string {
  return `ts=${timestamp},v1=${signMercadoPago(dataId, requestId, timestamp, secret)}`;
}

export interface MercadoPagoWebhookOptions {
  /** Override the webhook secret (defaults to {@code test-webhook-secret}). */
  secret?: string;
  /** Override the timestamp (defaults to {@code Date.now()}). */
  timestamp?: number;
  /** Override the data.id (defaults to a UUID). */
  dataId?: string;
}

/**
 * Compose a MercadoPago-shaped notification body for an
 * {@code invoice.paid} event.
 */
export function makePaidNotification(opts: MercadoPagoWebhookOptions = {}): {
  body: unknown;
  headers: Record<string, string>;
} {
  const timestamp = opts.timestamp ?? Date.now();
  const dataId = opts.dataId ?? randomUUID();
  const requestId = randomUUID();
  return {
    body: {
      action: 'payment.created',
      api_version: 'v1',
      data: { id: dataId },
      date_created: new Date(timestamp).toISOString(),
      id: dataId,
      live_mode: false,
      type: 'payment',
      user_id: 'test-user',
    },
    headers: {
      'x-signature': buildSignatureHeader(dataId, requestId, timestamp, opts.secret),
      'x-request-id': requestId,
    },
  };
}
