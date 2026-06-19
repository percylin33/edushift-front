import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '@core/services/api.service';
import { ApiResponse } from '@core/models/api-response.model';
import { API } from '@core/constants/api.constants';

/**
 * AI rubric generator service (FE-8.2).
 *
 * <p>Calls {@code POST /v1/ai/generate-rubric} (BE-8.2) and unwraps
 * the {@link ApiResponse} envelope. The endpoint is gated by
 * {@code LMS_AI_GENERATE} (TENANT_ADMIN + TEACHER) on the backend; if
 * the caller lacks the authority the BE returns 403 and we surface it
 * as an {@code AI_FORBIDDEN} error.</p>
 *
 * <h3>Decisions</h3>
 * <ul>
 *   <li><b>ADR-8.3</b> — {@code seedRubricId} is optional. When
 *       provided, the BE forks an existing rubric and the IA
 *       enriches it. When {@code null}, the IA generates from
 *       scratch using the supplied criteria.</li>
 *   <li><b>Decoupling</b> — the FE does NOT persist the rubric; the
 *       parent page calls {@code POST /v1/academic/rubrics} once the
 *       teacher accepts. Same rationale as the session generator.</li>
 * </ul>
 */
@Injectable({ providedIn: 'root' })
export class RubricGeneratorService {
  private readonly api = inject(ApiService);

  generate(request: RubricGeneratorRequest): Observable<RubricDraft> {
    if (!request.courseName) {
      return throwError(() => ({ code: 'AI_COURSE_REQUIRED', message: 'Selecciona un curso.' }));
    }
    if (!Array.isArray(request.criteria) || request.criteria.length === 0) {
      return throwError(() => ({
        code: 'AI_CRITERIA_REQUIRED',
        message: 'Añade al menos un criterio para generar la rúbrica.'
      }));
    }

    return this.api
      .post<ApiResponse<RubricDraft>, RubricGeneratorRequest>(
        API.AI.GENERATE_RUBRIC,
        request
      )
      .pipe(
        map((envelope) => {
          if (!envelope || !envelope.success || !envelope.data) {
            throw { code: 'AI_EMPTY_RESPONSE', message: 'El asistente devolvió una respuesta vacía.' };
          }
          return envelope.data;
        }),
        catchError((err: unknown) => throwError(() => mapHttpError(err)))
      );
  }
}

export interface RubricGeneratorRequest {
  courseName: string;
  criteria: string[];
  /** Optional: fork an existing rubric and IA-enrich it (ADR-8.3). */
  seedRubricId?: string | null;
  /** Optional: target levels (defaults to 4 when omitted). */
  levelCount?: number;
}

export interface RubricDraft {
  title: string;
  description?: string;
  criteria: RubricCriterion[];
  /** ISO-4217 currency if monetary. */
  currency?: string;
}

export interface RubricCriterion {
  name: string;
  weight: number;
  descriptors: Record<string, string>;
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
    case 400: return 'La solicitud es inválida (revisa los criterios y los datos del formulario).';
    case 401: return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    case 403: return code === 'AI_DISABLED'
      ? 'La IA está deshabilitada en este colegio.'
      : 'No tienes permiso para usar el asistente de IA.';
    case 429: return 'Has alcanzado la cuota de IA del colegio. Intenta de nuevo más tarde.';
    case 502: return 'El asistente tuvo un problema al generar la rúbrica. Reintenta.';
    case 503: return 'El asistente no está disponible en este momento. Reintenta.';
    default:  return `Error ${status} al generar la rúbrica.`;
  }
}
