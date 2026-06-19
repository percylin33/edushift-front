import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '@core/services/api.service';
import { ApiResponse } from '@core/models/api-response.model';
import { API } from '@core/constants/api.constants';

/**
 * AI session generator service (FE-8.1).
 *
 * <p>Calls {@code POST /v1/ai/generate-session} (BE-8.1) and unwraps the
 * {@link ApiResponse} envelope. The endpoint is gated by
 * {@code LMS_AI_GENERATE} (TENANT_ADMIN + TEACHER) on the backend; if the
 * caller lacks the authority the BE returns 403 and we surface it as an
 * {@code AI_FORBIDDEN} error.</p>
 *
 * <h3>Decisions</h3>
 * <ul>
 *   <li><b>ADR-8.2</b> — backend enforces strict JSON schema; the FE
 *       just renders the validated payload (no extra parsing).</li>
 *   <li><b>Decoupling</b> — the FE does NOT persist the session; it
 *       shows the AI-suggested draft and lets the teacher call
 *       {@code POST /v1/learning-sessions} once they accept. This
 *       avoids creating artifacts without explicit human approval.</li>
 * </ul>
 */
@Injectable({ providedIn: 'root' })
export class SessionGeneratorService {
  private readonly api = inject(ApiService);

  /**
   * Ask the assistant to draft a learning session for the given
   * topic + course + grade + duration. Returns the validated JSON
   * payload (the same shape the BE returns from the endpoint).
   */
  generate(request: SessionGeneratorRequest): Observable<SessionDraft> {
    const topic = (request.topic ?? '').trim();
    if (topic.length < 3) {
      return throwError(() => ({
        code: 'AI_TOPIC_REQUIRED',
        message: 'Indica un tema de al menos 3 caracteres.'
      }));
    }
    if (!request.courseName) {
      return throwError(() => ({
        code: 'AI_COURSE_REQUIRED',
        message: 'Selecciona un curso.'
      }));
    }
    if (!request.gradeName) {
      return throwError(() => ({
        code: 'AI_GRADE_REQUIRED',
        message: 'Selecciona un grado.'
      }));
    }
    if (request.durationMinutes < 15 || request.durationMinutes > 240) {
      return throwError(() => ({
        code: 'AI_DURATION_OUT_OF_RANGE',
        message: 'La duración debe estar entre 15 y 240 minutos.'
      }));
    }

    return this.api
      .post<ApiResponse<SessionDraft>, SessionGeneratorRequest>(
        API.AI.GENERATE_SESSION,
        request
      )
      .pipe(
        map((envelope) => {
          if (!envelope || !envelope.success || !envelope.data) {
            throw {
              code: 'AI_EMPTY_RESPONSE',
              message: 'El asistente devolvió una respuesta vacía.'
            };
          }
          return envelope.data;
        }),
        catchError((err: unknown) => throwError(() => mapHttpError(err)))
      );
  }
}

export interface SessionGeneratorRequest {
  topic: string;
  courseName: string;
  gradeName: string;
  durationMinutes: number;
  competencies?: string[];
}

export interface SessionDraft {
  title: string;
  activities: SessionActivity[];
  resources: SessionResource[];
  evaluationCriteria: string[];
}

export interface SessionActivity {
  phase: 'INICIO' | 'DESARROLLO' | 'CIERRE';
  description: string;
  durationMinutes: number;
}

export interface SessionResource {
  type: 'VIDEO' | 'DOCUMENT' | 'LINK' | 'BOOK';
  title: string;
  url?: string;
}

function mapHttpError(err: unknown): { code: string; message: string; httpStatus?: number } {
  if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
    return err as { code: string; message: string };
  }
  if (err instanceof HttpErrorResponse) {
    const apiErr = err.error as
      | { error?: { code?: string; message?: string }; message?: string }
      | undefined;
    const code = apiErr?.error?.code ?? apiErr?.message ?? 'AI_UNKNOWN';
    const message = apiErr?.error?.message ?? defaultMessageForStatus(err.status, code);
    return { code, message, httpStatus: err.status };
  }
  return { code: 'AI_UNKNOWN', message: 'Error desconocido.' };
}

function defaultMessageForStatus(status: number, code: string): string {
  switch (status) {
    case 0:   return 'Sin conexión con el servidor. Verifica tu red e inténtalo de nuevo.';
    case 400: return 'La solicitud es inválida (revisa el tema y los datos del formulario).';
    case 401: return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    case 403: return code === 'AI_DISABLED'
      ? 'La IA está deshabilitada en este colegio.'
      : 'No tienes permiso para usar el asistente de IA.';
    case 429: return 'Has alcanzado la cuota de IA del colegio. Intenta de nuevo más tarde.';
    case 502: return 'El asistente tuvo un problema al generar la sesión. Reintenta.';
    case 503: return 'El asistente no está disponible en este momento. Reintenta.';
    default:  return `Error ${status} al generar la sesión.`;
  }
}
