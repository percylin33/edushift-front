import { Injectable, inject, signal } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { Subject } from 'rxjs';
import { AuthService } from '@core/services/auth.service';

/**
 * Realtime STOMP client (Sprint 10 / FE-10.2, ADR-10.3, ADR-10.4).
 *
 * <p>Wraps {@code @stomp/stompjs} as a singleton service that
 * connects on first subscriber, reconnects on disconnect, and
 * exposes a {@link Subject} of incoming {@link NotificationPushPayload}
 * objects.</p>
 *
 * <h3>Why a singleton, not per-component</h3>
 * Multiple components (bell, dashboard) want realtime updates.
 * One socket, many subscribers. The underlying STOMP client
 * handles fan-out via topics, so multiple Angular components can
 * each {@code subscribe} without opening more sockets.</p>
 *
 * <h3>Auth</h3>
 * The BE expects the JWT in the {@code Authorization} header of the
 * STOMP CONNECT frame. We pull it from {@link AuthService} on
 * connect and refresh on every reconnect.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);

  private client: Client | null = null;
  private subs = new Map<string, StompSubscription>();
  readonly connected = signal(false);
  readonly incoming$ = new Subject<NotificationPushPayload>();

  /**
   * Connect to the STOMP endpoint. Idempotent — calling it twice
   * does nothing if the socket is already up.
   */
  connect(): void {
    if (this.client?.active) return;
    const wsUrl = this.resolveWsUrl();
    this.client = new Client({
      brokerURL: wsUrl,
      reconnectDelay: 5000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      connectHeaders: {
        Authorization: 'Bearer ' + (this.auth.getToken() ?? '')
      },
      onConnect: () => {
        this.connected.set(true);
        // Re-subscribe on every reconnect (Sprint 10 robustness).
        for (const [dest, sub] of this.subs.entries()) {
          // stompjs already restores subscriptions; this is belt+braces.
          if (!sub) this.subscribe(dest);
        }
      },
      onDisconnect: () => this.connected.set(false),
      onStompError: (frame) => {
        console.warn('[Realtime] STOMP error', frame.headers['message']);
      },
      onWebSocketClose: () => this.connected.set(false)
    });
    this.client.activate();
  }

  /**
   * Subscribe to a destination. The handler is invoked on every
   * message. Returns an unsubscribe function.
   */
  subscribe(destination: string): () => void {
    if (!this.client) {
      // Defer until connected.
      const unsub = () => this.subs.delete(destination);
      this.subs.set(destination, undefined as unknown as StompSubscription);
      this.connect();
      // Try to subscribe once the client connects.
      const t = setInterval(() => {
        if (this.client?.connected) {
          clearInterval(t);
          this.doSubscribe(destination);
        }
      }, 250);
      return unsub;
    }
    this.doSubscribe(destination);
    return () => {
      const sub = this.subs.get(destination);
      sub?.unsubscribe();
      this.subs.delete(destination);
    };
  }

  private doSubscribe(destination: string): void {
    if (!this.client?.connected) return;
    const sub = this.client.subscribe(destination, (msg: IMessage) => {
      try {
        const payload = JSON.parse(msg.body) as NotificationPushPayload;
        this.incoming$.next(payload);
      } catch (e) {
        console.warn('[Realtime] malformed payload', msg.body, e);
      }
    });
    this.subs.set(destination, sub);
  }

  disconnect(): void {
    this.client?.deactivate();
    this.client = null;
    this.subs.clear();
    this.connected.set(false);
  }

  /**
   * Derive the WS URL from the current API base URL.
   *   https://api.edushift.com/api/v1 → wss://api.edushift.com/ws/notify
   */
  private resolveWsUrl(): string {
    // We piggyback on the auth service's known host. The API base
    // is in the env config; for MVP we hardcode the well-known
    // path. A future refactor injects an env token here.
    const apiBase = (window as any).__EDUSHIFT_API_BASE__ ?? '';
    if (apiBase) {
      return apiBase.replace(/^http/, 'ws').replace(/\/api\/.*$/, '') + '/ws/notify';
    }
    // Fallback: same-origin.
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws/notify`;
  }
}

export interface NotificationPushPayload {
  notificationUuid: string;
  recipientUserId: string;
  templateKey: string;
  category: string;
  channel: 'IN_APP' | 'EMAIL' | 'BOTH';
  subject: string | null;
  occurredAt: string;
}
