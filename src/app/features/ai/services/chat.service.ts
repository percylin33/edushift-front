import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '@core/services';
import { ApiResponse } from '@core/models/api-response.model';
import { API } from '@core/constants/api.constants';
import { SseClientService, SseHttpError } from './sse-client.service';

/**
 * AI chat service (FE-8.3).
 *
 * <p>Wraps the BE-8.3 chat endpoints. The send-message endpoint
 * returns {@code text/event-stream} (SSE); we use the
 * {@link HttpClient#post} overload with
 * {@code observe: 'events', reportProgress: true} to read the
 * stream chunk-by-chunk and surface each token to the caller via
 * an {@link Observable} of {@link ChatChunk} values.</p>
 *
 * <h3>Decisions</h3>
 * <ul>
 *   <li><b>Cancel-friendly</b> — the stream's subscription can be
 *       unsubscribed mid-flight; the underlying XHR is aborted and
 *       the BE records the assistant message as
 *       {@code CANCELLED}.</li>
 *   <li><b>Per-session model</b> — the service is stateless: each
 *       call is independent. UI state (current session, message
 *       list, streaming buffer) lives in the
 *       {@code ChatPageComponent}.</li>
 * </ul>
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly api = inject(ApiService);
  private readonly sseClient = inject(SseClientService);

  /** List the caller's active chat sessions, newest first. */
  listSessions(limit = 20): Observable<ChatSession[]> {
    return this.api
      .get<ApiResponse<ChatSessionResponse[]>>(`${API.AI.CHAT}/sessions`, { limit })
      .pipe(map((e) => (e.data ?? []).map(toChatSession)));
  }

  /** Create a new chat session. */
  createSession(): Observable<ChatSession> {
    return this.api
      .post<ApiResponse<ChatSessionResponse>>(`${API.AI.CHAT}/sessions`, {})
      .pipe(map((e) => toChatSession(e.data)));
  }

  /** List all visible messages of a session. */
  listMessages(sessionPublicUuid: string): Observable<ChatMessage[]> {
    return this.api
      .get<ApiResponse<ChatMessageResponse[]>>(`${API.AI.CHAT}/sessions/${sessionPublicUuid}/messages`)
      .pipe(map((e) => (e.data ?? []).map(toChatMessage)));
  }

  /** Soft-delete a session. */
  deleteSession(sessionPublicUuid: string): Observable<void> {
    return this.api
      .delete<ApiResponse<unknown>>(`${API.AI.CHAT}/sessions/${sessionPublicUuid}`)
      .pipe(map(() => undefined));
  }

  /**
   * Send a user message and stream the assistant reply as SSE
   * chunks. Caller subscribes to the returned Observable; on
   * unsubscribe, the underlying HTTP request is aborted and the
   * BE records the message as {@code CANCELLED}.
   *
   * <p>The BE's stream format is:
   * <ul>
   *   <li>{@code event: token} — {@code data: <chunk>}</li>
   *   <li>{@code event: done}  — {@code data: {"publicUuid": "...", "cancelled": false}}</li>
   *   <li>{@code event: error} — {@code data: <message>}</li>
   * </ul>
   *
   * <p>Implementation note: SSE streaming uses {@link SseClientService},
   * which sends the auth cookies via {@code fetch} (Angular interceptors
   * do not apply to the streaming API).
   */
  sendMessage(
    sessionPublicUuid: string,
    text: string,
  ): { chunks$: Observable<ChatChunk>; cancel: () => void } {
    const chunks$ = new Subject<ChatChunk>();
    const url = `${API.AI.CHAT}/sessions/${sessionPublicUuid}/messages`;

    const subscription = this.sseClient.stream(url, { text }).subscribe({
      next: (token) => {
        if (token.event === 'token') {
          chunks$.next({ kind: 'token', text: token.data });
        } else if (token.event === 'done') {
          try {
            const parsed = JSON.parse(token.data) as { publicUuid: string; cancelled: boolean };
            chunks$.next({
              kind: 'done',
              publicUuid: parsed.publicUuid,
              cancelled: !!parsed.cancelled,
            });
          } catch {
            chunks$.next({ kind: 'done' });
          }
        } else if (token.event === 'error') {
          chunks$.next({ kind: 'error', message: token.data });
        }
      },
      error: (err: unknown) => {
        const message =
          err instanceof SseHttpError
            ? `HTTP ${err.status}: ${err.message}`
            : (err as Error)?.message ?? 'Error desconocido.';
        chunks$.next({ kind: 'error', message });
        chunks$.complete();
      },
      complete: () => chunks$.complete(),
    });

    return {
      chunks$: chunks$.asObservable(),
      cancel: () => {
        subscription.unsubscribe();
        chunks$.next({ kind: 'cancelled' });
        chunks$.complete();
      },
    };
  }
}

export interface ChatSession {
  id: string;
  publicUuid: string;
  title: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  messageCount: number;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  publicUuid: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  status: 'PENDING' | 'STREAMING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  createdAt: string;
}

export type ChatChunk =
  | { kind: 'token'; text: string }
  | { kind: 'done'; publicUuid?: string; cancelled?: boolean }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

interface ChatSessionResponse {
  id?: string | null;
  publicUuid?: string | null;
  title?: string | null;
  status?: ChatSession['status'] | null;
  messageCount?: number | null;
  updatedAt?: string | null;
  lastMessageAt?: string | null;
}

interface ChatMessageResponse {
  id?: string | null;
  publicUuid?: string | null;
  role?: ChatMessage['role'] | null;
  content?: string | null;
  status?: ChatMessage['status'] | null;
  createdAt?: string | null;
}

function toChatSession(s: ChatSessionResponse): ChatSession {
  return {
    id: s.id ?? s.publicUuid ?? '',
    publicUuid: s.publicUuid ?? s.id ?? '',
    title: s.title ?? 'Nueva conversacion',
    status: s.status ?? 'ACTIVE',
    messageCount: s.messageCount ?? 0,
    updatedAt: s.updatedAt ?? s.lastMessageAt ?? '',
  };
}

function toChatMessage(m: ChatMessageResponse): ChatMessage {
  return {
    id: m.id ?? m.publicUuid ?? '',
    publicUuid: m.publicUuid ?? m.id ?? '',
    role: m.role ?? 'ASSISTANT',
    content: m.content ?? '',
    status: m.status ?? 'COMPLETED',
    createdAt: m.createdAt ?? '',
  };
}
