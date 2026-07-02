import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API } from '@core/constants';
import { ApiResponse } from '@core/models';
import { ApiService } from '@core/services';
import {
  BulkGradeRecordRequest,
  BulkGradeRecordResponseRaw,
  BulkGradeRecordSummary,
  CreateGradeRecordRequest,
  GradeRecordDetail,
  GradeRecordFilters,
  GradeRecordListItemRaw,
  GradeRecordResponseRaw,
  GradeRecordRow,
  UpdateGradeRecordRequest,
  toBulkSummary,
  toGradeRecordDetail,
  toGradeRecordRow,
} from '../models';

/**
 * HTTP boundary del módulo {@code grade-records} (Sprint 5B / FE-5B.3).
 *
 * <h3>Endpoint coverage</h3>
 * <ul>
 *   <li>{@link #listByEvaluation} → {@code GET    /v1/academic/evaluations/{uuid}/grade-records}</li>
 *   <li>{@link #upsertGrade}      → {@code POST   /v1/academic/evaluations/{uuid}/grade-records}</li>
 *   <li>{@link #bulkUpsert}       → {@code POST   /v1/academic/evaluations/{uuid}/grade-records/bulk}</li>
 *   <li>{@link #getGrade}         → {@code GET    /v1/academic/grade-records/{publicUuid}}</li>
 *   <li>{@link #updateGrade}      → {@code PUT    /v1/academic/grade-records/{publicUuid}}</li>
 *   <li>{@link #deleteGrade}      → {@code DELETE /v1/academic/grade-records/{publicUuid}}</li>
 * </ul>
 *
 * <p>Layout dual de los endpoints (BE-5B.3): los <em>nested</em>
 * (list / register / bulk-register) cuelgan del padre evaluation porque
 * ese scope hace falta para la validación per-scale; los <em>flat</em>
 * (get / update / delete) se direccionan por el UUID del grade-record
 * porque es lo que tiene a la mano la fila editada de la grilla.</p>
 */
@Injectable({ providedIn: 'root' })
export class GradeRecordsApiService {
  private readonly api = inject(ApiService);

  // ===========================================================================
  // List per evaluation
  // ===========================================================================

  listByEvaluation(
    evaluationPublicUuid: string,
    filters: GradeRecordFilters = {},
  ): Observable<GradeRecordRow[]> {
    const params: Record<string, string | undefined> = {
      studentPublicUuid: filters.studentPublicUuid,
      sectionPublicUuid: filters.sectionPublicUuid,
      isActive: filters.isActive === undefined ? undefined : String(filters.isActive),
    };
    return this.api
      .get<GradeRecordListItemRaw[]>(API.GRADE_RECORDS.BY_EVALUATION(evaluationPublicUuid), params)
      .pipe(map((rows) => rows.map((r) => toGradeRecordRow(r))));
  }

  // ===========================================================================
  // Single upsert
  // ===========================================================================

  /**
   * Idempotent upsert: si ya existe el (evaluation, student) actualiza,
   * si no lo crea. ADR-5B.5 + GRADE_RECORD_UPSERT.
   */
  upsertGrade(
    evaluationPublicUuid: string,
    request: CreateGradeRecordRequest,
  ): Observable<GradeRecordDetail> {
    return this.api
      .post<ApiResponse<GradeRecordResponseRaw>, CreateGradeRecordRequest>(
        API.GRADE_RECORDS.BY_EVALUATION(evaluationPublicUuid),
        sanitizeCreate(request),
      )
      .pipe(map((envelope) => toGradeRecordDetail(envelope.data)));
  }

  // ===========================================================================
  // Bulk upsert (atomic)
  // ===========================================================================

  /**
   * Atomic batch (ADR-5B.6): la primera fila inválida aborta todo el
   * batch con {@code GRADE_BULK_INVALID_ROW}. El backend valida shape +
   * enrollment de cada fila ANTES de persistir nada — partial saves
   * imposibles.
   */
  bulkUpsert(
    evaluationPublicUuid: string,
    request: BulkGradeRecordRequest,
  ): Observable<BulkGradeRecordSummary> {
    return this.api
      .post<ApiResponse<BulkGradeRecordResponseRaw>, BulkGradeRecordRequest>(
        API.GRADE_RECORDS.BULK(evaluationPublicUuid),
        { records: request.records.map(sanitizeCreate) },
      )
      .pipe(map((envelope) => toBulkSummary(envelope.data)));
  }

  // ===========================================================================
  // Flat by publicUuid
  // ===========================================================================

  getGrade(publicUuid: string): Observable<GradeRecordDetail> {
    return this.api
      .get<ApiResponse<GradeRecordResponseRaw>>(API.GRADE_RECORDS.BY_ID(publicUuid))
      .pipe(map((envelope) => toGradeRecordDetail(envelope.data)));
  }

  /**
   * Patch parcial. {@code null} fields preservan el valor actual; el
   * (evaluation, student) tuple es inmutable. Para cambiar el target hay
   * que DELETE + POST (BE-5B.3).
   */
  updateGrade(publicUuid: string, patch: UpdateGradeRecordRequest): Observable<GradeRecordDetail> {
    return this.api
      .put<ApiResponse<GradeRecordResponseRaw>, UpdateGradeRecordRequest>(
        API.GRADE_RECORDS.BY_ID(publicUuid),
        sanitizeUpdate(patch),
      )
      .pipe(map((envelope) => toGradeRecordDetail(envelope.data)));
  }

  deleteGrade(publicUuid: string): Observable<void> {
    return this.api.delete<void>(API.GRADE_RECORDS.BY_ID(publicUuid));
  }
}

// =============================================================================
// Internals
// =============================================================================

/**
 * Limpia el payload de create para que el server reciba {@code null} en
 * vez de {@code undefined} (Jackson tolera ambos pero el contract Java
 * espera la ausencia explícita) y trim de {@code literal} / {@code comments}.
 */
function sanitizeCreate(req: CreateGradeRecordRequest): CreateGradeRecordRequest {
  return {
    studentPublicUuid: req.studentPublicUuid.trim(),
    score: req.score === undefined ? null : req.score,
    literal: req.literal ? req.literal.trim().toUpperCase() : null,
    comments: req.comments?.trim() ? req.comments.trim() : null,
  };
}

function sanitizeUpdate(req: UpdateGradeRecordRequest): UpdateGradeRecordRequest {
  return {
    score: req.score === undefined ? null : req.score,
    literal: req.literal ? req.literal.trim().toUpperCase() : req.literal,
    comments: req.comments,
  };
}
