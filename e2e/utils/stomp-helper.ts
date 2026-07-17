import WebSocket from 'ws';
import { APIRequestContext } from '@playwright/test';

/**
 * STOMP-over-WebSocket client for testing realtime notifications.
 *
 * <p>EduShift's notification bell ({@code NotificationBellComponent})
 * subscribes to {@code /topic/tenant/{tenantId}/user/{userId}} over
 * STOMP. To verify a published announcement reaches the bell in
 * real time, we connect a parallel WS client from Node and watch for
 * the message.</p>
 *
 * <h3>Usage</h3>
 *
 * <pre>{@code
 * const watcher = await stompSubscribe(api, {
 *   tenantId: '...',
 *   userId: '...',
 *   topic: '/topic/tenant/<tid>/user/<uid>',
 * });
 *
 * // Trigger the side-effect that publishes to the topic
 * await api.post('/api/v1/announcements/.../publish', ...);
 *
 * const msg = await watcher.nextMessage({ timeout: 10_000 });
 * expect(msg?.body).toContain('...');
 *
 * await watcher.close();
 * </pre>
 */

export interface StompSubscribeOptions {
  /** Full STOMP topic, e.g. {@code /topic/tenant/<id>/user/<id>}. */
  topic: string;
  /** {@code User.PublicUuid} — used only for logging. */
  userId: string;
  /** Tenant public UUID — used only for logging. */
  tenantId: string;
  /** STOMP host. Defaults to {@code http://localhost:8081}. */
  baseUrl?: string;
}

export interface StompMessage {
  /** STOMP frame command, typically {@code MESSAGE}. */
  command: string;
  /** STOMP headers (lowercased keys). */
  headers: Record<string, string>;
  /** Decoded JSON body if applicable. */
  body: unknown;
}

export interface StompSubscription {
  /** Resolves with the next message, or {@code null} on timeout / disconnect. */
  nextMessage(options?: { timeout?: number }): Promise<StompMessage | null>;
  /** Queue all messages received (useful for `await drain()`). */
  messages: () => StompMessage[];
  /** Close the underlying socket and resolve any pending {@link nextMessage} with null. */
  close(): Promise<void>;
}

const NULL_FRAME = '\x00';

/**
 * Open a STOMP-over-WS connection, subscribe to {@code topic}, and
 * return a handle. The handle buffers all incoming messages and
 * exposes a {@link StompSubscription.nextMessage} promise that resolves
 * with the first message that arrives after the call.
 *
 * <p>Connections are STOMP 1.2 over plain WS. The EduShift server
 * supports {@code /ws} (SockJS-compatible). For STOMP-only clients
 * we connect directly to the underlying WebSocket endpoint.</p>
 */
export async function stompSubscribe(
  api: APIRequestContext,
  opts: StompSubscribeOptions,
): Promise<StompSubscription> {
  const baseUrl = (opts.baseUrl ?? process.env['API_URL'] ?? 'http://localhost:8081').replace(/\/$/, '');
  const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws';

  // We need a bearer token to authenticate the WebSocket upgrade.
  const token = await extractAccessToken(api);

  const ws = new WebSocket(wsUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const inbox: StompMessage[] = [];
  const waiters: ((msg: StompMessage | null) => void)[] = [];
  let connected = false;

  const opened = new Promise<void>((resolve, reject) => {
    ws.once('open', () => {
      // STOMP CONNECT frame — minimal headers.
      ws.send(
        'CONNECT\n' +
          'accept-version:1.2\n' +
          'host:localhost\n' +
          'heart-beat:10000,10000\n' +
          '\n' +
          NULL_FRAME,
      );
    });
    ws.once('error', reject);
    ws.on('message', (raw: Buffer) => {
      const text = raw.toString('utf8');
      if (!connected) {
        // First server frame should be CONNECTED (or ERROR).
        if (text.startsWith('CONNECTED')) {
          connected = true;
          resolve();
          // Send SUBSCRIBE.
          ws.send(
            'SUBSCRIBE\n' +
              `id:sub-${Math.random().toString(36).slice(2, 10)}\n` +
              `destination:${opts.topic}\n` +
              '\n' +
              NULL_FRAME,
          );
          return;
        }
        if (text.startsWith('ERROR')) {
          reject(new Error(`STOMP error: ${text}`));
          return;
        }
      }
      // Parse MESSAGE frame.
      if (text.startsWith('MESSAGE')) {
        const parsed = parseStompFrame(text);
        inbox.push(parsed);
        // Resolve any pending waiters in FIFO order.
        while (waiters.length && inbox.length) {
          const w = waiters.shift()!;
          w(inbox.shift() ?? null);
        }
      }
    });
  });

  await opened;

  return {
    messages: () => inbox.slice(),
    nextMessage: ({ timeout = 10_000 } = {}) =>
      new Promise<StompMessage | null>((resolve) => {
        if (inbox.length > 0) return resolve(inbox.shift() ?? null);
        const waiter = (msg: StompMessage | null) => resolve(msg);
        waiters.push(waiter);
        setTimeout(() => {
          const idx = waiters.indexOf(waiter);
          if (idx >= 0) {
            waiters.splice(idx, 1);
            resolve(null);
          }
        }, timeout);
      }),
    close: () =>
      new Promise<void>((resolve) => {
        ws.once('close', () => resolve());
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('DISCONNECT\n\n' + NULL_FRAME);
          ws.close();
        } else {
          resolve();
        }
      }),
  };
}

function parseStompFrame(text: string): StompMessage {
  const headerEnd = text.indexOf('\n\n');
  const headersRaw = text.slice(0, headerEnd);
  const bodyRaw = text.slice(headerEnd + 2).replace(NULL_FRAME, '');
  const headers: Record<string, string> = {};
  for (const line of headersRaw.split('\n').slice(1)) {
    const idx = line.indexOf(':');
    if (idx >= 0) {
      headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
    }
  }
  let body: unknown = bodyRaw;
  const ct = headers['content-type'] ?? '';
  if (ct.startsWith('application/json') && bodyRaw.length > 0) {
    try {
      body = JSON.parse(bodyRaw);
    } catch {
      /* leave as string */
    }
  }
  return { command: 'MESSAGE', headers, body };
}

async function extractAccessToken(api: APIRequestContext): Promise<string> {
  // {@code APIRequestContext} exposes the storage state via the
  // fixture; but we got here from a raw APIRequestContext, not the
  // Page context. The simplest reliable approach: hit /auth/me with
  // the bearer header that the API helper would have set — but we
  // don't have it here. Callers should pass a real api that has
  // already authenticated and just use its storage state.
  //
  // Workaround: read the storage state from the API context's
  // `extraHTTPHeaders` if set; otherwise fail loudly so the spec
  // author fixes it.
  // @ts-expect-error — internal but stable across playwright versions
  const headers = api._options?.extraHTTPHeaders as Record<string, string> | undefined;
  const auth = headers?.['Authorization'] ?? headers?.['authorization'];
  if (!auth) {
    throw new Error(
      'stompSubscribe requires an apiContext that already authenticated — ' +
        'pass the same apiContextFor(...) that you used for /auth/me so ' +
        'the Authorization header is present.',
    );
  }
  return auth.replace(/^Bearer\s+/i, '');
}
