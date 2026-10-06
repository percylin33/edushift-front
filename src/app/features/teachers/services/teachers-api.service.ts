import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap } from 'rxjs';
import { API } from '@core/constants';
import { ApiResponse, SpringPage } from '@core/models';
import { ApiService } from '@core/services';
import { BulkImportStatus } from '@core/enums';
import {
  AssignmentDetail,
  AssignmentListFilters,
  AssignmentListItemRaw,
  AssignmentResponseRaw,
  AssignmentRow,
  CreateAssignmentRequest,
  CreateTeacherRequest,
  InviteTeacherResponseRaw,
  LinkTeacherUserRequest,
  SectionTeacherItem,
  SectionTeacherItemRaw,
  SectionTeachersFilters,
  TeacherDetail,
  TeacherInvitationResult,
  TeacherListFilters,
  TeacherListItemRaw,
  TeacherListPagination,
  TeacherResponseRaw,
  TeacherRow,
  TenantAssignmentListFilters,
  UpdateTeacherRequest,
  computeTeacherFullName,
} from '../models';
import {
  BulkImportJob,
  BulkImportJobResponseRaw,
  BulkImportPreview,
  BulkImportPreviewRaw,
  BulkImportRowError,
  BulkImportRowErrorRaw,
} from '../../students/models';

/**
 * HTTP boundary para el módulo {@code teachers}
 * ({@code /api/v1/teachers}, BE-4.6).
 *
 * <h3>Endpoint coverage</h3>
 * <ul>
 *   <li>{@link #list}     → {@code GET    /v1/teachers}</li>
 *   <li>{@link #get}      → {@code GET    /v1/teachers/{publicUuid}}</li>
 *   <li>{@link #create}   → {@code POST   /v1/teachers}</li>
 *   <li>{@link #update}   → {@code PUT    /v1/teachers/{publicUuid}}</li>
 *   <li>{@link #linkUser} → {@code POST   /v1/teachers/{publicUuid}/link-user}</li>
 *   <li>{@link #invite}   → {@code POST   /v1/teachers/{publicUuid}/invite}</li>
 *   <li>{@link #delete}   → {@code DELETE /v1/teachers/{publicUuid}}</li>
 * </ul>
 *
 * <p>Adapters al final convierten timestamps ISO a {@link Date} y
 * surgen los {@code null} del wire como {@code undefined} idiomático.
 * El {@code fullName} no viene en la list (BE optimizó payload), así
 * que lo computamos client-side con {@link computeTeacherFullName}.</p>
 */
@Injectable({ providedIn: 'root' })
export class TeachersApiService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  // ===========================================================================
  // CRUD
  // ===========================================================================

  /**
   * Lista paginada con filtros opcionales. Retorna el envelope
   * {@code Page<T>} de Spring tal cual — misma convención de
   * {@code GET /v1/users} y {@code /v1/students}.
   */
  list(
    filters: TeacherListFilters = {},
    pagination: TeacherListPagination = {},
  ): Observable<SpringPage<TeacherRow>> {
    const params: Record<string, string | number | boolean | undefined> = {
      search: filters.search?.trim() || undefined,
      employmentStatus: filters.employmentStatus,
      hasUserAccount: filters.hasUserAccount,
      page: pagination.page,
      size: pagination.size,
      sort: pagination.sort,
    };

    return this.api
      .get<SpringPage<TeacherListItemRaw>>(API.TEACHERS.ROOT, params)
      .pipe(map((page) => this.toTeacherPage(page)));
  }

  get(publicUuid: string): Observable<TeacherDetail> {
    return this.api
      .get<ApiResponse<TeacherResponseRaw>>(API.TEACHERS.BY_ID(publicUuid))
      .pipe(map((envelope) => this.toTeacherDetail(envelope.data)));
  }

  /** Linked teacher profile for the authenticated TEACHER user. */
  getMe(): Observable<TeacherDetail> {
    return this.api
      .get<ApiResponse<TeacherResponseRaw>>(API.TEACHERS.ME)
      .pipe(map((envelope) => this.toTeacherDetail(envelope.data)));
  }

  /**
   * Active assignments for the authenticated TEACHER (shortcut over
   * {@link getMe} + {@link listAssignments}).
   */
  listMyAssignments(filters: AssignmentListFilters = {}): Observable<AssignmentRow[]> {
    return this.getMe().pipe(
      switchMap((me) => this.listAssignments(me.publicUuid, filters)),
    );
  }

  create(request: CreateTeacherRequest): Observable<TeacherDetail> {
    return this.api
      .post<ApiResponse<TeacherResponseRaw>, CreateTeacherRequest>(API.TEACHERS.ROOT, request)
      .pipe(map((envelope) => this.toTeacherDetail(envelope.data)));
  }

  /**
   * Partial-merge. {@code null} = clear (en los nullable como
   * {@code email}); {@code undefined} = no-op (la prop se omite del
   * JSON antes de salir al wire). Misma convención de students.
   */
  update(publicUuid: string, patch: UpdateTeacherRequest): Observable<TeacherDetail> {
    return this.api
      .put<ApiResponse<TeacherResponseRaw>, UpdateTeacherRequest>(
        API.TEACHERS.BY_ID(publicUuid),
        patch,
      )
      .pipe(map((envelope) => this.toTeacherDetail(envelope.data)));
  }

  /**
   * Vincula al docente con un User existente del mismo tenant que ya
   * tenga el rol {@code TEACHER}. Errores conocidos:
   * <ul>
   *   <li>409 {@code TEACHER_ALREADY_HAS_USER}</li>
   *   <li>409 {@code USER_NOT_TEACHER_ROLE}</li>
   *   <li>409 {@code USER_ALREADY_LINKED_TO_TEACHER}</li>
   *   <li>404 {@code RESOURCE_NOT_FOUND}</li>
   * </ul>
   */
  linkUser(publicUuid: string, request: LinkTeacherUserRequest): Observable<TeacherDetail> {
    return this.api
      .post<ApiResponse<TeacherResponseRaw>, LinkTeacherUserRequest>(
        API.TEACHERS.LINK_USER(publicUuid),
        request,
      )
      .pipe(map((envelope) => this.toTeacherDetail(envelope.data)));
  }

  /**
   * Crea una invitación con {@code metadata.teacherId} apuntando al
   * docente y rol {@code TEACHER}. Sprint 9 enviará el email; mientras
   * tanto la UI muestra el link copiable que devuelve este endpoint.
   *
   * <h3>Errores</h3>
   * <ul>
   *   <li>409 {@code TEACHER_ALREADY_HAS_USER} — ya tiene cuenta.</li>
   *   <li>422 {@code TEACHER_NEEDS_EMAIL_TO_INVITE} — falta email.</li>
   * </ul>
   */
  invite(publicUuid: string): Observable<TeacherInvitationResult> {
    return this.api
      .post<ApiResponse<InviteTeacherResponseRaw>>(API.TEACHERS.INVITE(publicUuid))
      .pipe(map((envelope) => this.toInvitationResult(envelope.data)));
  }

  /**
   * Soft-delete. El back marca {@code deleted = true} y deja de
   * mostrarlo en queries. Rechaza con 409
   * {@code TEACHER_HAS_ACTIVE_ASSIGNMENTS} si aún tiene assignments
   * activas (BE-4.7) — el caller debería soft-end-earlas primero.
   */
  delete(publicUuid: string): Observable<void> {
    return this.api.delete<void>(API.TEACHERS.BY_ID(publicUuid));
  }

  // ===========================================================================
  // Assignments (FE-4.7 / BE-4.7)
  // ===========================================================================

  /**
   * Lista las assignments del docente. Por defecto excluye las
   * soft-ended; pasar {@code active: false} trae el historial completo.
   *
   * <p>El back retorna {@code List<AssignmentListItem>} sin envelope
   * (mismo patrón que {@code GET /levels} y otros endpoints de
   * proyección plana).</p>
   */
  listAssignments(
    teacherPublicUuid: string,
    filters: AssignmentListFilters = {},
  ): Observable<AssignmentRow[]> {
    const params: Record<string, string | boolean | undefined> = {
      periodId: filters.periodId,
      active: filters.active,
    };
    return this.api
      .get<AssignmentListItemRaw[]>(API.TEACHERS.ASSIGNMENTS(teacherPublicUuid), params)
      .pipe(map((rows) => rows.map((r) => this.toAssignmentRow(r))));
  }

  /**
   * Listado tenant-wide de asignaciones con filtros opcionales
   * ({@code GET /v1/teacher-assignments}). Usado por el picker de
   * Registros del {@code TENANT_ADMIN}.
   */
  listTenantAssignments(
    filters: TenantAssignmentListFilters = {},
  ): Observable<AssignmentRow[]> {
    const params: Record<string, string | boolean | undefined> = {
      teacherId: filters.teacherId,
      sectionId: filters.sectionId,
      courseId: filters.courseId,
      periodId: filters.periodId,
      active: filters.active,
    };
    return this.api
      .get<AssignmentListItemRaw[]>(API.TEACHER_ASSIGNMENTS.ROOT, params)
      .pipe(map((rows) => rows.map((r) => this.toAssignmentRow(r))));
  }

  /**
   * Crea una assignment {@code (teacher, section, course, period)}.
   * Errores conocidos del back:
   * <ul>
   *   <li>409 {@code TEACHER_NOT_ACTIVE} — el docente está en
   *       {@code ON_LEAVE / SUSPENDED / RETIRED / RESIGNED}.</li>
   *   <li>409 {@code ASSIGNMENT_YEAR_MISMATCH} — section.year ≠
   *       period.year.</li>
   *   <li>409 {@code COURSE_NOT_APPLICABLE_TO_SECTION_LEVEL} — el
   *       course no está vinculado al level del grade de la sección.</li>
   *   <li>409 {@code ASSIGNMENT_ALREADY_ACTIVE} — ya existe row activa
   *       para esta tupla.</li>
   *   <li>404 {@code RESOURCE_NOT_FOUND}.</li>
   * </ul>
   */
  createAssignment(
    teacherPublicUuid: string,
    request: CreateAssignmentRequest,
  ): Observable<AssignmentDetail> {
    return this.api
      .post<ApiResponse<AssignmentResponseRaw>, CreateAssignmentRequest>(
        API.TEACHERS.ASSIGNMENTS(teacherPublicUuid),
        request,
      )
      .pipe(map((envelope) => this.toAssignmentDetail(envelope.data)));
  }

  /**
   * Soft-end de una assignment ({@code unassigned_at = NOW()}).
   * Idempotente: re-issue sobre una row ya cerrada también devuelve
   * 204. La row queda en histórico para reportes / audit.
   */
  softEndAssignment(assignmentPublicUuid: string): Observable<void> {
    return this.api.delete<void>(API.ASSIGNMENTS.BY_ID(assignmentPublicUuid));
  }

  /**
   * Reverse view: lista los docentes asignados a una sección. El
   * back agrupa por {@code (teacher, course, period)} activo.
   */
  listSectionTeachers(
    sectionPublicUuid: string,
    filters: SectionTeachersFilters = {},
  ): Observable<SectionTeacherItem[]> {
    const params: Record<string, string | undefined> = {
      periodId: filters.periodId,
    };
    return this.api
      .get<SectionTeacherItemRaw[]>(API.ACADEMIC.SECTIONS.TEACHERS(sectionPublicUuid), params)
      .pipe(map((rows) => rows.map((r) => this.toSectionTeacherItem(r))));
  }

  // ---------------------------------------------------------------------------
  // Adapters
  // ---------------------------------------------------------------------------

  private toTeacherPage(raw: SpringPage<TeacherListItemRaw>): SpringPage<TeacherRow> {
    return {
      ...raw,
      content: raw.content.map((row) => this.toTeacherRow(row)),
    };
  }

  private toTeacherRow(raw: TeacherListItemRaw): TeacherRow {
    return {
      publicUuid: raw.publicUuid,
      documentType: raw.documentType,
      documentNumber: raw.documentNumber,
      firstName: raw.firstName,
      lastName: raw.lastName,
      secondLastName: raw.secondLastName ?? undefined,
      fullName: computeTeacherFullName(raw.firstName, raw.lastName, raw.secondLastName),
      email: raw.email ?? undefined,
      title: raw.title ?? undefined,
      specializations: raw.specializations ?? [],
      employmentStatus: raw.employmentStatus,
      hasUserAccount: raw.hasUserAccount,
    };
  }

  private toTeacherDetail(raw: TeacherResponseRaw): TeacherDetail {
    return {
      publicUuid: raw.publicUuid,
      documentType: raw.documentType,
      documentNumber: raw.documentNumber,
      firstName: raw.firstName,
      lastName: raw.lastName,
      secondLastName: raw.secondLastName ?? undefined,
      fullName: computeTeacherFullName(raw.firstName, raw.lastName, raw.secondLastName),
      birthDate: this.parseDate(raw.birthDate),
      gender: raw.gender ?? undefined,
      email: raw.email ?? undefined,
      phone: raw.phone ?? undefined,
      title: raw.title ?? undefined,
      specializations: raw.specializations ?? [],
      hireDate: this.parseDate(raw.hireDate),
      employmentStatus: raw.employmentStatus,
      hasUserAccount: raw.userPublicUuid !== null,
      userPublicUuid: raw.userPublicUuid ?? undefined,
      metadata: raw.metadata ?? undefined,
      createdAt: this.parseDate(raw.createdAt),
      updatedAt: this.parseDate(raw.updatedAt),
    };
  }

  private toInvitationResult(raw: InviteTeacherResponseRaw): TeacherInvitationResult {
    return {
      invitationPublicUuid: raw.invitationPublicUuid,
      invitationToken: raw.invitationToken,
      expiresAt: this.parseDate(raw.expiresAt),
      teacherPublicUuid: raw.teacherPublicUuid,
      email: raw.email,
    };
  }

  private toAssignmentRow(raw: AssignmentListItemRaw): AssignmentRow {
    return {
      publicUuid: raw.publicUuid,
      teacherPublicUuid: raw.teacherPublicUuid,
      teacherFullName: raw.teacherFullName,
      sectionPublicUuid: raw.sectionPublicUuid,
      sectionName: raw.sectionName,
      gradeName: raw.gradeName ?? null,
      coursePublicUuid: raw.coursePublicUuid,
      courseCode: raw.courseCode,
      courseName: raw.courseName,
      courseColor: raw.courseColor ?? null,
      courseIcon: raw.courseIcon ?? null,
      academicPeriodPublicUuid: raw.academicPeriodPublicUuid,
      periodType: raw.periodType,
      periodOrdinal: raw.periodOrdinal,
      assignedAt: this.parseDate(raw.assignedAt),
      unassignedAt: this.parseDate(raw.unassignedAt),
      active: raw.active,
    };
  }

  private toAssignmentDetail(raw: AssignmentResponseRaw): AssignmentDetail {
    return {
      publicUuid: raw.publicUuid,
      teacherPublicUuid: raw.teacherPublicUuid,
      teacherFullName: raw.teacherFullName,
      sectionPublicUuid: raw.sectionPublicUuid,
      sectionName: raw.sectionName,
      gradeName: raw.gradeName ?? null,
      coursePublicUuid: raw.coursePublicUuid,
      courseCode: raw.courseCode,
      courseName: raw.courseName,
      courseColor: raw.courseColor ?? null,
      courseIcon: raw.courseIcon ?? null,
      academicPeriodPublicUuid: raw.academicPeriodPublicUuid,
      periodType: raw.periodType,
      periodOrdinal: raw.periodOrdinal,
      periodName: raw.periodName,
      academicYearPublicUuid: raw.academicYearPublicUuid,
      academicYearName: raw.academicYearName,
      assignedAt: this.parseDate(raw.assignedAt),
      unassignedAt: this.parseDate(raw.unassignedAt),
      active: raw.active,
      notes: raw.notes ?? undefined,
      createdAt: this.parseDate(raw.createdAt),
      updatedAt: this.parseDate(raw.updatedAt),
    };
  }

  private toSectionTeacherItem(raw: SectionTeacherItemRaw): SectionTeacherItem {
    return {
      assignmentPublicUuid: raw.assignmentPublicUuid,
      teacherPublicUuid: raw.teacherPublicUuid,
      teacherFullName: raw.teacherFullName,
      teacherEmail: raw.teacherEmail ?? undefined,
      coursePublicUuid: raw.coursePublicUuid,
      courseCode: raw.courseCode,
      courseName: raw.courseName,
      academicPeriodPublicUuid: raw.academicPeriodPublicUuid,
      periodType: raw.periodType,
      periodOrdinal: raw.periodOrdinal,
      assignedAt: this.parseDate(raw.assignedAt),
    };
  }

  private parseDate(value: string | null | undefined): Date | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  // ===========================================================================
  // Bulk import
  // ===========================================================================

  /** {@code GET /v1/teachers/bulk-import/template} — binary .xlsx. */
  downloadBulkTemplate(): Observable<Blob> {
    return this.http.get(API.TEACHERS.BULK_IMPORT.TEMPLATE, {
      responseType: 'blob',
    });
  }

  /** {@code POST /v1/teachers/bulk-import/preview} — headers + suggested mapping. */
  previewBulkImport(file: File): Observable<BulkImportPreview> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http
      .post<ApiResponse<BulkImportPreviewRaw>>(API.TEACHERS.BULK_IMPORT.PREVIEW, form)
      .pipe(
        map((envelope) => {
          const raw = envelope.data;
          return {
            headers: raw.headers ?? [],
            sampleRows: raw.sampleRows ?? [],
            suggestedMapping: raw.suggestedMapping ?? {},
            unmappedRequired: raw.unmappedRequired ?? [],
          };
        }),
      );
  }

  /** {@code POST /v1/teachers/bulk-import} — enqueue async job (202). */
  uploadBulkImport(
    file: File,
    columnMapping?: Record<string, string>,
  ): Observable<BulkImportJob> {
    const form = new FormData();
    form.append('file', file, file.name);
    if (columnMapping && Object.keys(columnMapping).length > 0) {
      form.append('columnMapping', JSON.stringify(columnMapping));
    }
    return this.http
      .post<ApiResponse<BulkImportJobResponseRaw>>(API.TEACHERS.BULK_IMPORT.ROOT, form)
      .pipe(map((envelope) => this.toBulkImportJob(envelope.data)));
  }

  /** {@code GET /v1/teachers/bulk-import/{publicUuid}} — poll progress. */
  getBulkImportJob(publicUuid: string): Observable<BulkImportJob> {
    return this.api
      .get<ApiResponse<BulkImportJobResponseRaw>>(API.TEACHERS.BULK_IMPORT.BY_ID(publicUuid))
      .pipe(map((envelope) => this.toBulkImportJob(envelope.data)));
  }

  private toBulkImportJob(raw: BulkImportJobResponseRaw): BulkImportJob {
    return {
      publicUuid: raw.publicUuid,
      jobType: raw.jobType,
      status: raw.status as BulkImportStatus,
      fileName: raw.fileName,
      fileSizeBytes: raw.fileSizeBytes,
      totalRows: raw.totalRows ?? undefined,
      processedRows: raw.processedRows,
      errorRows: raw.errorRows,
      errors: this.toRowErrors(raw.errors),
      failReason: raw.failReason ?? undefined,
      startedAt: this.parseDate(raw.startedAt),
      finishedAt: this.parseDate(raw.finishedAt),
      createdAt: this.parseDate(raw.createdAt),
    };
  }

  private toRowErrors(raw: BulkImportRowErrorRaw[] | null | undefined): BulkImportRowError[] {
    if (!raw || raw.length === 0) return [];
    return raw.map((e) => ({ row: e.row, code: e.code, message: e.message }));
  }
}
