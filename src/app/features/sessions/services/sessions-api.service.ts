import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API } from '@core/constants';
import { ApiResponse } from '@core/models';
import { ApiService } from '@core/services';
import {
  LearningSessionDetail,
  LearningSessionFilters,
  LearningSessionListItemRaw,
  LearningSessionResponseRaw,
  LearningSessionRow,
  LifecycleRequest,
  CreateLearningSessionRequest,
  UpdateLearningSessionRequest
} from '../models';

/**
 * HTTP boundary del módulo {@code sessions}. Sprint 5A / FE-5A.4 cubre
 * el listado con filtros y las transiciones de lifecycle.
 *
 * <h3>Endpoint coverage</h3>
 * <ul>
 *   <li>{@link #listSessions} → {@code GET /v1/learning-sessions} (con filtros)</li>
 *   <li>{@link #getSession} → {@code GET /v1/learning-sessions/{publicUuid}}</li>
 *   <li>{@link #createSession} → {@code POST /v1/learning-sessions}</li>
 *   <li>{@link #updateSession} → {@code PUT /v1/learning-sessions/{publicUuid}}</li>
 *   <li>{@link #deleteSession} → {@code DELETE /v1/learning-sessions/{publicUuid}}</li>
 *   <li>{@link #startSession} → {@code POST /v1/learning-sessions/{publicUuid}/start}</li>
 *   <li>{@link #completeSession} → {@code POST /v1/learning-sessions/{publicUuid}/complete}</li>
 *   <li>{@link #cancelSession} → {@code POST /v1/learning-sessions/{publicUuid}/cancel}</li>
 *   <li>{@link #getSessionsByAssignment} → {@code GET /v1/teacher-assignments/{assignmentUuid}/sessions}</li>
 *   <li>{@link #getSessionsByUnit} → {@code GET /v1/academic/units/{unitUuid}/sessions}</li>
 * </ul>
 */
@Injectable({ providedIn: 'root' })
export class SessionsApiService {
  private readonly api = inject(ApiService);

  /**
   * Lista sesiones de aprendizaje con filtros opcionales.
   * Backend ordena por {@code scheduled_date desc, created_at desc}.
   */
  listSessions(filters: LearningSessionFilters = {}): Observable<LearningSessionRow[]> {
    const params: Record<string, string | undefined> = {
      teacherId: filters.teacherUuid,
      sectionId: filters.sectionUuid,
      unitId: filters.unitUuid,
      periodId: filters.periodUuid,
      status: filters.status,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo
    };
    return this.api
      .get<LearningSessionListItemRaw[]>(API.SESSIONS.ROOT, params)
      .pipe(map((rows) => rows.map((r) => this.toSessionRow(r))));
  }

  getSession(publicUuid: string): Observable<LearningSessionDetail> {
    return this.api
      .get<ApiResponse<LearningSessionResponseRaw>>(API.SESSIONS.BY_ID(publicUuid))
      .pipe(map((envelope) => this.toSessionDetail(envelope.data)));
  }

  createSession(request: CreateLearningSessionRequest): Observable<LearningSessionDetail> {
    return this.api
      .post<ApiResponse<LearningSessionResponseRaw>, CreateLearningSessionRequest>(
        API.SESSIONS.ROOT,
        request
      )
      .pipe(map((envelope) => this.toSessionDetail(envelope.data)));
  }

  updateSession(
    publicUuid: string,
    patch: UpdateLearningSessionRequest
  ): Observable<LearningSessionDetail> {
    return this.api
      .put<ApiResponse<LearningSessionResponseRaw>, UpdateLearningSessionRequest>(
        API.SESSIONS.BY_ID(publicUuid),
        patch
      )
      .pipe(map((envelope) => this.toSessionDetail(envelope.data)));
  }

  deleteSession(publicUuid: string): Observable<void> {
    return this.api.delete<void>(API.SESSIONS.BY_ID(publicUuid));
  }

  /**
   * Transición: PLANNED → IN_PROGRESS.
   * Requiere {@code version} para optimistic lock.
   */
  startSession(publicUuid: string, request: LifecycleRequest): Observable<LearningSessionDetail> {
    return this.api
      .post<ApiResponse<LearningSessionResponseRaw>, LifecycleRequest>(
        API.SESSIONS.START(publicUuid),
        request
      )
      .pipe(map((envelope) => this.toSessionDetail(envelope.data)));
  }

  /**
   * Transición: IN_PROGRESS → COMPLETED.
   * Requiere {@code version} para optimistic lock.
   */
  completeSession(publicUuid: string, request: LifecycleRequest): Observable<LearningSessionDetail> {
    return this.api
      .post<ApiResponse<LearningSessionResponseRaw>, LifecycleRequest>(
        API.SESSIONS.COMPLETE(publicUuid),
        request
      )
      .pipe(map((envelope) => this.toSessionDetail(envelope.data)));
  }

  /**
   * Transición: cualquier no-terminal → CANCELLED.
   * Requiere {@code version} para optimistic lock.
   */
  cancelSession(publicUuid: string, request: LifecycleRequest): Observable<LearningSessionDetail> {
    return this.api
      .post<ApiResponse<LearningSessionResponseRaw>, LifecycleRequest>(
        API.SESSIONS.CANCEL(publicUuid),
        request
      )
      .pipe(map((envelope) => this.toSessionDetail(envelope.data)));
  }

  getSessionsByAssignment(assignmentUuid: string): Observable<LearningSessionRow[]> {
    return this.api
      .get<LearningSessionListItemRaw[]>(API.SESSIONS.BY_ASSIGNMENT(assignmentUuid))
      .pipe(map((rows) => rows.map((r) => this.toSessionRow(r))));
  }

  getSessionsByUnit(unitUuid: string): Observable<LearningSessionRow[]> {
    return this.api
      .get<LearningSessionListItemRaw[]>(API.SESSIONS.BY_UNIT(unitUuid))
      .pipe(map((rows) => rows.map((r) => this.toSessionRow(r))));
  }

  // ---------------------------------------------------------------------------
  // Adapters
  // ---------------------------------------------------------------------------

  private toSessionRow(raw: LearningSessionListItemRaw): LearningSessionRow {
    return {
      publicUuid: raw.publicUuid,
      version: raw.version,
      title: raw.title,
      scheduledDate: this.parseDate(raw.scheduledDate)!,
      durationMinutes: raw.durationMinutes,
      status: raw.status,
      startedAt: raw.startedAt ? this.parseDate(raw.startedAt) : undefined,
      endedAt: raw.endedAt ? this.parseDate(raw.endedAt) : undefined,
      cancelledAt: raw.cancelledAt ? this.parseDate(raw.cancelledAt) : undefined,
      teacherName: raw.assignment.teacherName,
      courseCode: raw.assignment.courseCode,
      sectionName: raw.assignment.sectionName,
      unitName: raw.unit.name,
      unitDisplayOrder: raw.unit.displayOrder
    };
  }

  private toSessionDetail(raw: LearningSessionResponseRaw): LearningSessionDetail {
    return {
      publicUuid: raw.publicUuid,
      version: raw.version,
      assignment: {
        publicUuid: raw.assignment.publicUuid,
        teacher: raw.assignment.teacher,
        course: raw.assignment.course,
        section: raw.assignment.section,
        period: {
          ...raw.assignment.period,
          startDate: this.parseDate(raw.assignment.period.startDate)!,
          endDate: this.parseDate(raw.assignment.period.endDate)!
        }
      },
      unit: raw.unit,
      title: raw.title,
      objective: raw.objective,
      scheduledDate: this.parseDate(raw.scheduledDate)!,
      durationMinutes: raw.durationMinutes,
      status: raw.status,
      content: raw.content,
      competencies: raw.competencies,
      capacities: raw.capacities,
      startedAt: raw.startedAt ? this.parseDate(raw.startedAt) : undefined,
      endedAt: raw.endedAt ? this.parseDate(raw.endedAt) : undefined,
      cancelledAt: raw.cancelledAt ? this.parseDate(raw.cancelledAt) : undefined,
      createdAt: this.parseDate(raw.createdAt),
      updatedAt: this.parseDate(raw.updatedAt)
    };
  }

  private parseDate(value: string | null | undefined): Date | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
}
