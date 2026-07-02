import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API } from '@core/constants';
import { ApiResponse } from '@core/models';
import { ApiService } from '@core/services';
import { RubricDetail, RubricResponseRaw, toRubricDetail } from '@features/rubrics/models';
import {
  CreateEvaluationRequest,
  EvaluationDetail,
  EvaluationFilters,
  EvaluationListItemRaw,
  EvaluationResponseRaw,
  EvaluationRow,
  UpdateEvaluationRequest,
  toEvaluationDetail,
  toEvaluationRow,
} from '../models';

/** Body de `POST /v1/academic/evaluations/{publicUuid}/rubric`. */
interface AttachRubricRequest {
  rubricPublicUuid: string;
}

/**
 * HTTP boundary del módulo {@code evaluations} (Sprint 5B / FE-5B.1).
 *
 * <h3>Endpoint coverage</h3>
 * <ul>
 *   <li>{@link #listByAssignment}  → {@code GET    /v1/academic/teacher-assignments/{uuid}/evaluations}</li>
 *   <li>{@link #createForAssignment} → {@code POST  /v1/academic/teacher-assignments/{uuid}/evaluations}</li>
 *   <li>{@link #getEvaluation}     → {@code GET    /v1/academic/evaluations/{publicUuid}}</li>
 *   <li>{@link #updateEvaluation}  → {@code PUT    /v1/academic/evaluations/{publicUuid}}</li>
 *   <li>{@link #publishEvaluation} → {@code POST   /v1/academic/evaluations/{publicUuid}/publish}</li>
 *   <li>{@link #closeEvaluation}   → {@code POST   /v1/academic/evaluations/{publicUuid}/close}</li>
 *   <li>{@link #deleteEvaluation}  → {@code DELETE /v1/academic/evaluations/{publicUuid}}</li>
 * </ul>
 *
 * <p>El backend devuelve siempre el envelope {@code ApiResponse<T>} salvo
 * en el listing (que devuelve {@code List<EvaluationListItem>} pelado por
 * coherencia con el resto del módulo academic — ver
 * {@code AcademicApiService.listLevels}).</p>
 */
@Injectable({ providedIn: 'root' })
export class EvaluationsApiService {
  private readonly api = inject(ApiService);

  /**
   * Lista evaluations de un {@code TeacherAssignment}. El backend ya
   * ordena por {@code scheduledDate desc} y aplica los filtros, así que
   * la UI no necesita re-ordenar ni re-filtrar client-side.
   *
   * <p>Cross-tenant: {@code 404 RESOURCE_NOT_FOUND} si el assignment
   * pertenece a otro tenant — la promesa se rechaza con el mensaje
   * estándar de la pipeline de errores.</p>
   */
  listByAssignment(
    assignmentPublicUuid: string,
    filters: EvaluationFilters = {},
  ): Observable<EvaluationRow[]> {
    const params: Record<string, string | undefined> = {
      status: filters.status,
      isActive: filters.isActive === undefined ? undefined : String(filters.isActive),
      from: filters.from,
      to: filters.to,
    };
    return this.api
      .get<EvaluationListItemRaw[]>(API.EVALUATIONS.BY_ASSIGNMENT(assignmentPublicUuid), params)
      .pipe(map((rows) => rows.map((r) => toEvaluationRow(r))));
  }

  /**
   * Lee una evaluation por su {@code publicUuid}. La sección de
   * "anclajes" ({@code unitPublicUuid}, {@code learningSessionPublicUuid})
   * llega como UUID — el FE resuelve el label en una segunda llamada
   * cuando lo renderiza en el detail (DEBT: ideal sería denormalizar el
   * label en el response, pero MVP).
   */
  getEvaluation(publicUuid: string): Observable<EvaluationDetail> {
    return this.api
      .get<ApiResponse<EvaluationResponseRaw>>(API.EVALUATIONS.BY_ID(publicUuid))
      .pipe(map((envelope) => toEvaluationDetail(envelope.data)));
  }

  /**
   * Crea una evaluation. Server-side enforce de:
   * <ul>
   *   <li>Unicidad de {@code name} dentro del assignment (case-insensitive).</li>
   *   <li>Coherencia {@code kind × scale}.</li>
   *   <li>{@code dueDate ≥ scheduledDate} cuando ambos están presentes.</li>
   *   <li>Coherencia cross-context de {@code unitPublicUuid} y
   *       {@code learningSessionPublicUuid} contra el assignment.</li>
   * </ul>
   * El status inicial es siempre {@code DRAFT} (no es addressable desde el body).
   */
  createForAssignment(
    assignmentPublicUuid: string,
    request: CreateEvaluationRequest,
  ): Observable<EvaluationDetail> {
    return this.api
      .post<ApiResponse<EvaluationResponseRaw>, CreateEvaluationRequest>(
        API.EVALUATIONS.BY_ASSIGNMENT(assignmentPublicUuid),
        request,
      )
      .pipe(map((envelope) => toEvaluationDetail(envelope.data)));
  }

  /**
   * Patch parcial. La editability matrix vive en el backend
   * (DRAFT libre / PUBLISHED restringido a {@code description} y
   * {@code dueDate} / CLOSED rechazado con {@code EVAL_CLOSED}).
   *
   * <p>Para limpiar un anchor pasar string vacío en
   * {@code unitPublicUuid} o {@code learningSessionPublicUuid}
   * (ADR-5B.4).</p>
   */
  updateEvaluation(
    publicUuid: string,
    patch: UpdateEvaluationRequest,
  ): Observable<EvaluationDetail> {
    return this.api
      .put<ApiResponse<EvaluationResponseRaw>, UpdateEvaluationRequest>(
        API.EVALUATIONS.BY_ID(publicUuid),
        patch,
      )
      .pipe(map((envelope) => toEvaluationDetail(envelope.data)));
  }

  /**
   * Lifecycle hop {@code DRAFT → PUBLISHED}. Idempotente sobre evaluations
   * que ya están PUBLISHED. Rechaza con {@code EVAL_INVALID_TRANSITION}
   * si la evaluation está CLOSED.
   */
  publishEvaluation(publicUuid: string): Observable<EvaluationDetail> {
    return this.api
      .post<ApiResponse<EvaluationResponseRaw>>(API.EVALUATIONS.PUBLISH(publicUuid))
      .pipe(map((envelope) => toEvaluationDetail(envelope.data)));
  }

  /**
   * Lifecycle hop {@code PUBLISHED → CLOSED}. {@code CLOSED} es 100%
   * terminal (ADR-5B.7). El servidor rechaza {@code DRAFT → CLOSED} con
   * {@code EVAL_INVALID_TRANSITION}.
   */
  closeEvaluation(publicUuid: string): Observable<EvaluationDetail> {
    return this.api
      .post<ApiResponse<EvaluationResponseRaw>>(API.EVALUATIONS.CLOSE(publicUuid))
      .pipe(map((envelope) => toEvaluationDetail(envelope.data)));
  }

  /**
   * Soft-delete. Solo DRAFT. PUBLISHED responde {@code 409
   * EVAL_PUBLISHED_NOT_DELETABLE} y CLOSED {@code 409 EVAL_CLOSED}.
   * BE-5B.4 además gatea con {@code 409 EVAL_HAS_GRADES} cuando la
   * evaluation ya tiene grade records.
   */
  deleteEvaluation(publicUuid: string): Observable<void> {
    return this.api.delete<void>(API.EVALUATIONS.BY_ID(publicUuid));
  }

  // ===========================================================================
  // Rubric attachment (Sprint 5B / FE-5B.5)
  // ===========================================================================

  /**
   * Vincula (o reemplaza) la rúbrica de una evaluation. Replace-style
   * upsert: si ya había una rúbrica vinculada, el server soft-deletea la
   * link previa e inserta la nueva en la misma transacción.
   */
  attachRubric(evaluationPublicUuid: string, rubricPublicUuid: string): Observable<RubricDetail> {
    return this.api
      .post<ApiResponse<RubricResponseRaw>, AttachRubricRequest>(
        API.EVALUATIONS.RUBRIC(evaluationPublicUuid),
        { rubricPublicUuid },
      )
      .pipe(map((envelope) => toRubricDetail(envelope.data)));
  }

  /**
   * Trae la rúbrica vinculada o {@code null} cuando no hay ninguna
   * (404 {@code EVAL_RUBRIC_NOT_SET} colapsa a {@code null} en el FE
   * para que la UI no tenga que tratar 404 como un caso especial).
   */
  getAttachedRubric(evaluationPublicUuid: string): Observable<RubricDetail> {
    return this.api
      .get<ApiResponse<RubricResponseRaw>>(API.EVALUATIONS.RUBRIC(evaluationPublicUuid))
      .pipe(map((envelope) => toRubricDetail(envelope.data)));
  }

  /**
   * Desvincula la rúbrica actual. Sin body. 404 {@code EVAL_RUBRIC_NOT_SET}
   * cuando la evaluation no tenía nada vinculado (el FE evita la llamada
   * en ese caso).
   */
  detachRubric(evaluationPublicUuid: string): Observable<void> {
    return this.api.delete<void>(API.EVALUATIONS.RUBRIC(evaluationPublicUuid));
  }
}
