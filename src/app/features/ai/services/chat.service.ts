import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiService } from '@core/services/api.service';
import { ApiResponse } from '@core/models/api-response.model';
import { API } from '@core/constants/api.constants';
import { firstValueFrom } from 'rxjs';

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
  private readonly http = inject(HttpClient);

  /** List the caller's active chat sessions, newest first. */
  listSessions(limit = 20): Observable<ChatSession[]> {
    return this.api
      .get<ApiResponse<ChatSession[]>>(`${API.AI.CHAT}/sessions`, { limit })
      .pipe(map((e) => (e.data ?? []).map(toChatSession)));
  }

  /** Create a new chat session. */
  createSession(): Observable<ChatSession> {
    return this.api
      .post<ApiResponse<ChatSession>>(`${API.AI.CHAT}/sessions`, {})
      .pipe(map((e) => toChatSession(e.data)));
  }

  /** List all visible messages of a session. */
  listMessages(sessionPublicUuid: string): Observable<ChatMessage[]> {
    return this.api
      .get<ApiResponse<ChatMessage[]>>(`${API.AI.CHAT}/sessions/${sessionPublicUuid}/messages`)
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
   * <p>Implementation note: we use the native
   * {@link HttpClient#request} with {@code responseType: 'text'} and
   * a manual SSE parser. The Angular HTTP client does not natively
   * expose SSE event types, so we read the raw text stream and
   * split on {@code \n\n}.
   */
  sendMessage(
    sessionPublicUuid: string,
    text: string,
  ): { chunks$: Observable<ChatChunk>; cancel: () => void } {
    const controller = new AbortController();
    const chunks$ = new Subject<ChatChunk>();
    const url = `${API.AI.CHAT}/sessions/${sessionPublicUuid}/messages`;

    void this.streamSse(url, text, controller, chunks$);
    return {
      chunks$: chunks$.asObservable(),
      cancel: () => controller.abort(),
    };
  }

  private async streamSse(
    url: string,
    text: string,
    controller: AbortController,
    chunks$: Subject<ChatChunk>,
  ): Promise<void> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        credentials: 'include',
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const errBody = await res.text().catch(() => '');
        chunks$.next({
          kind: 'error',
          message: `HTTP ${res.status}: ${errBody || res.statusText}`,
        });
        chunks$.complete();
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE events are separated by a blank line (\n\n).
        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) >= 0) {
          const event = buffer.substring(0, sep);
          buffer = buffer.substring(sep + 2);
          this.parseSseEvent(event, chunks$);
        }
      }
      if (buffer.length > 0) this.parseSseEvent(buffer, chunks$);
      chunks$.complete();
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        chunks$.next({ kind: 'cancelled' });
      } else {
        chunks$.next({ kind: 'error', message: e?.message ?? 'Error desconocido.' });
      }
      chunks$.complete();
    }
  }

  private parseSseEvent(raw: string, chunks$: Subject<ChatChunk>): void {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) event = line.substring(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.substring(5).trim());
    }
    const data = dataLines.join('\n');
    if (event === 'token') {
      chunks$.next({ kind: 'token', text: data });
    } else if (event === 'done') {
      try {
        const parsed = JSON.parse(data) as { publicUuid: string; cancelled: boolean };
        chunks$.next({
          kind: 'done',
          publicUuid: parsed.publicUuid,
          cancelled: !!parsed.cancelled,
        });
      } catch {
        chunks$.next({ kind: 'done' });
      }
    } else if (event === 'error') {
      chunks$.next({ kind: 'error', message: data });
    }
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

function toChatSession(s: any): ChatSession {
  return {
    id: s.id ?? s.publicUuid,
    publicUuid: s.publicUuid ?? s.id,
    title: s.title ?? 'Nueva conversacion',
    status: s.status ?? 'ACTIVE',
    messageCount: s.messageCount ?? 0,
    updatedAt: s.updatedAt ?? s.lastMessageAt ?? '',
  };
}

function toChatMessage(m: any): ChatMessage {
  return {
    id: m.id ?? m.publicUuid,
    publicUuid: m.publicUuid ?? m.id,
    role: m.role ?? 'ASSISTANT',
    content: m.content ?? '',
    status: m.status ?? 'COMPLETED',
    createdAt: m.createdAt ?? '',
  };
}
