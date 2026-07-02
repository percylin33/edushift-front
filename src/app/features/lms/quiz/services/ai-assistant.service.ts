import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, delay, map } from 'rxjs/operators';
import { ApiService } from '@core/services/api.service';
import { ApiResponse } from '@core/models/api-response.model';
import { API } from '@core/constants/api.constants';
import {
  AiAssistantRequest,
  AiAssistantStatus,
  QuestionSuggestion,
} from '../models/ai-assistant.model';

/**
 * AI Assistant service (FE-7c.1) — wired against the backend.
 *
 * <p>Calls {@code POST /v1/lms/ai/quiz-questions} (BE-7c.1) and unwraps the
 * {@link ApiResponse} envelope. The endpoint is gated by
 * {@code LMS_AI_GENERATE} (TENANT_ADMIN + TEACHER) on the backend; if the
 * caller lacks the authority the BE returns 403 and we surface it as an
 * {@code AI_FORBIDDEN} error.</p>
 *
 * <h3>Failure mapping</h3>
 * <table>
 *   <tr><th>HTTP</th><th>Code</th><th>When</th></tr>
 *   <tr><td>400</td><td>AI_VALIDATION</td><td>{@code topic} blank / {@code count} out of range</td></tr>
 *   <tr><td>403</td><td>AI_DISABLED</td><td>Tenant's master AI switch is off</td></tr>
 *   <tr><td>403</td><td>AI_FORBIDDEN</td><td>Caller lacks {@code LMS_AI_GENERATE}</td></tr>
 *   <tr><td>429</td><td>AI_QUOTA_EXCEEDED</td><td>Daily / monthly quota exhausted</td></tr>
 *   <tr><td>502</td><td>AI_PARSE_ERROR / LLM_*</td><td>LLM upstream failure or invalid JSON</td></tr>
 * </table>
 *
 * <h3>Pre-flight validation</h3>
 * <p>The same checks the BE performs are mirrored here so the panel can show
 * an inline error before the request leaves the browser (saves a round-trip
 * and an audit row).</p>
 */
@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  private readonly api = inject(ApiService);

  /**
   * Ask the assistant for {@code request.count} question suggestions on the
   * given topic. Returns {@code Observable<QuestionSuggestion[]>} (the BE's
   * {@code ApiResponse.data.questions} already unwrapped).
   */
  suggest(request: AiAssistantRequest): Observable<QuestionSuggestion[]> {
    const topic = (request.topic ?? '').trim();
    if (topic.length < 2) {
      return throwError(() => ({
        code: 'AI_TOPIC_REQUIRED',
        message: 'Indica un tema de al menos 2 caracteres.',
      }));
    }
    if (request.count < 1 || request.count > 10) {
      return throwError(() => ({
        code: 'AI_COUNT_OUT_OF_RANGE',
        message: 'La cantidad debe estar entre 1 y 10.',
      }));
    }

    const body = {
      topic,
      count: request.count,
      questionType: request.questionType ?? null,
    };

    return this.api
      .post<ApiResponse<WireSuggestionResponse>, typeof body>(API.LMS.AI_SUGGEST_QUESTIONS, body)
      .pipe(
        map((envelope) => {
          if (!envelope || !envelope.success || !envelope.data) {
            throw {
              code: 'AI_EMPTY_RESPONSE',
              message: 'El asistente devolvió una respuesta vacía.',
            };
          }
          return envelope.data.questions.map(toQuestionSuggestion);
        }),
        catchError((err: unknown) => {
          const mapped = mapHttpError(err);
          return throwError(() => mapped);
        }),
      );
  }

  /** Map an {@link AiAssistantStatus} to a human-readable Spanish label. */
  statusLabel(status: AiAssistantStatus): string {
    switch (status) {
      case AiAssistantStatus.Idle:
        return 'Listo';
      case AiAssistantStatus.Loading:
        return 'Generando sugerencias…';
      case AiAssistantStatus.Success:
        return 'Sugerencias listas';
      case AiAssistantStatus.Error:
        return 'Error al generar';
    }
  }
}

// ---------------------------------------------------------------------------
// Wire shape (BE-7c.1 `SuggestQuizQuestionsResponse`)
// ---------------------------------------------------------------------------

interface WireSuggestionResponse {
  questions: WireQuestion[];
  model: string;
  provider: string;
  promptVersion: string;
  generationUuids: string[];
}

interface WireQuestion {
  id: string;
  prompt: string;
  questionType: 'MC' | 'TF' | 'SHORT_ANSWER';
  points: number;
  options: Array<{ label: string; isCorrect: boolean; explanation: string | null }>;
  rationale: string;
}

/** Convert the BE wire shape into the panel's domain model. The shape is
 * essentially identical today (FE-7b.4 already used the same fields) but we
 * keep the adapter so future drift is contained to this function. */
function toQuestionSuggestion(w: WireQuestion): QuestionSuggestion {
  return {
    id: w.id,
    prompt: w.prompt,
    questionType: w.questionType,
    points: w.points,
    options: (w.options ?? []).map((o) => ({
      label: o.label,
      isCorrect: !!o.isCorrect,
      explanation: o.explanation ?? null,
    })),
    rationale: w.rationale ?? '',
  };
}

/** Map an HttpErrorResponse (or pre-flight throw) to the panel's error
 * shape `{code, message}`. We keep the BE error code when available (it
 * comes in {@code error.error.error.code} per the {@code ApiError} shape,
 * see {@code GlobalExceptionHandler}). */
function mapHttpError(err: unknown): { code: string; message: string; httpStatus?: number } {
  if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
    // Pre-flight throw (no HTTP).
    return err as { code: string; message: string };
  }
  if (err instanceof HttpErrorResponse) {
    const apiErr = err.error as
      { error?: { code?: string; message?: string }; message?: string } | undefined;
    const code = apiErr?.error?.code ?? apiErr?.message ?? 'AI_UNKNOWN';
    const message = apiErr?.error?.message ?? defaultMessageForStatus(err.status, code);
    return { code, message, httpStatus: err.status };
  }
  const e = err as { message?: string };
  return { code: 'AI_UNKNOWN', message: e?.message ?? 'Error desconocido.' };
}

function defaultMessageForStatus(status: number, code: string): string {
  switch (status) {
    case 0:
      return 'Sin conexión con el servidor. Verifica tu red e inténtalo de nuevo.';
    case 400:
      return 'La solicitud es inválida (revisa el tema y la cantidad).';
    case 401:
      return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    case 403:
      return code === 'AI_DISABLED'
        ? 'La IA está deshabilitada en este colegio.'
        : 'No tienes permiso para usar el asistente de IA.';
    case 429:
      return 'Has alcanzado la cuota de IA del colegio. Intenta de nuevo más tarde.';
    case 502:
      return 'El asistente tuvo un problema al generar las preguntas. Reintenta.';
    case 503:
      return 'El asistente no está disponible en este momento. Reintenta.';
    default:
      return `Error ${status} al generar sugerencias.`;
  }
}
