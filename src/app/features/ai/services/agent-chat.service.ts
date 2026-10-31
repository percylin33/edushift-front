import { Injectable, inject } from '@angular/core';
import { Observable, Subject, map } from 'rxjs';
import { ApiService } from '@core/services';
import { API } from '@core/constants/api.constants';
import { ApiResponse } from '@core/models/api-response.model';
import { SseClientService } from './sse-client.service';

export type AgentType = 'TUTOR' | 'TEACHER' | 'FAMILY';

export interface AiCapabilities {
  planCode: string | null;
  aiEnabled: boolean;
  assistants: Record<AgentType, boolean>;
  requestsRemainingToday: number;
  tokensRemainingThisMonth: number;
  dailyResetAt: string;
  blockedReason: string | null;
}

export interface AgentSession {
  publicUuid: string;
  agentType: AgentType;
  subjectPublicUuid: string | null;
  title: string;
  messageCount: number;
  updatedAt: string;
}

export interface AgentMessage {
  publicUuid: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  status: string;
  createdAt: string;
  citations?: AgentCitation[];
}

export interface AgentCitation {
  sourcePublicUuid: string;
  filePublicUuid: string | null;
  fileName: string | null;
  sourceScope?: 'SCHOOL' | 'EDUSHIFT' | null;
  title: string;
  kind: string;
  sourceUrl: string | null;
  sourceVersion: string | null;
  effectiveAt: string | null;
  pageNumber: number | null;
  ordinal: number;
  text?: string;
  score?: number;
}

export type AgentEvent =
  | { kind: 'token'; text: string }
  | { kind: 'citation'; citation: AgentCitation }
  | { kind: 'done'; publicUuid: string; cancelled: boolean }
  | { kind: 'error'; code: string; message: string };

@Injectable({ providedIn: 'root' })
export class AgentChatService {
  private readonly api = inject(ApiService);
  private readonly sse = inject(SseClientService);

  capabilities(): Observable<AiCapabilities> {
    return this.api.get<ApiResponse<AiCapabilities>>(API.AI.CAPABILITIES)
      .pipe(map((response) => response.data));
  }

  listSessions(type: AgentType): Observable<AgentSession[]> {
    return this.api.get<ApiResponse<AgentSession[]>>(
      `${API.AI.AGENTS}/${type}/sessions`).pipe(map((response) => response.data ?? []));
  }

  createSession(type: AgentType, subjectPublicUuid?: string): Observable<AgentSession> {
    return this.api.post<ApiResponse<AgentSession>>(
      `${API.AI.AGENTS}/${type}/sessions`, { subjectPublicUuid: subjectPublicUuid ?? null })
      .pipe(map((response) => response.data));
  }

  messages(type: AgentType, sessionId: string): Observable<AgentMessage[]> {
    return this.api.get<ApiResponse<AgentMessage[]>>(
      `${API.AI.AGENTS}/${type}/sessions/${encodeURIComponent(sessionId)}/messages`)
      .pipe(map((response) => response.data ?? []));
  }

  send(type: AgentType, sessionId: string, text: string):
    { events$: Observable<AgentEvent>; cancel: () => void } {
    const events = new Subject<AgentEvent>();
    const url = `${API.AI.AGENTS}/${type}/sessions/${encodeURIComponent(sessionId)}/messages`;
    const subscription = this.sse.stream(url, { text },
      { 'Idempotency-Key': crypto.randomUUID() }).subscribe({
      next: (token) => {
        if (token.event === 'token') {
          events.next({ kind: 'token', text: token.data });
        } else if (token.event === 'citation') {
          try {
            events.next({ kind: 'citation', citation: JSON.parse(token.data) as AgentCitation });
          } catch { /* Ignore malformed citation metadata. */ }
        } else if (token.event === 'done') {
          try {
            const data = JSON.parse(token.data) as { publicUuid: string; cancelled: boolean };
            events.next({ kind: 'done', publicUuid: data.publicUuid, cancelled: data.cancelled });
          } catch {
            events.next({ kind: 'error', code: 'AI_STREAM_INVALID',
              message: 'La respuesta llegó incompleta.' });
          }
        } else if (token.event === 'error') {
          try {
            const data = JSON.parse(token.data) as { code: string; message: string };
            events.next({ kind: 'error', code: data.code, message: data.message });
          } catch {
            events.next({ kind: 'error', code: 'AI_ERROR', message: token.data });
          }
        }
      },
      error: () => {
        events.next({ kind: 'error', code: 'AI_CONNECTION_FAILED',
          message: 'No se pudo conectar con el asistente.' });
        events.complete();
      },
      complete: () => events.complete(),
    });
    return { events$: events.asObservable(), cancel: () => subscription.unsubscribe() };
  }
}
