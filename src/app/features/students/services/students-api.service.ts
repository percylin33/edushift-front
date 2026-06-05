import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API } from '@core/constants';
import { ApiResponse, SpringPage } from '@core/models';
import { ApiService } from '@core/services';
import {
  AddGuardianRequest,
  BulkImportJob,
  BulkImportJobResponseRaw,
  BulkImportRowError,
  BulkImportRowErrorRaw,
  CreateStudentRequest,
  Guardian,
  GuardianResponseRaw,
  StudentDetail,
  StudentListFilters,
  StudentListItemRaw,
  StudentListPagination,
  StudentResponseRaw,
  StudentRow,
  UpdateGuardianLinkRequest,
  UpdateStudentRequest
} from '../models';

/**
 * HTTP boundary for the {@code students} module
 * ({@code /api/v1/students}) and the bulk-import flow underneath
 * ({@code /api/v1/students/bulk-import}).
 *
 * <h3>Why one service, not two</h3>
 * Bulk-import is a thin wrapper over a single resource (the
 * {@code BulkImportJob} aggregate scoped to {@code STUDENTS}); keeping
 * it inside {@link StudentsApiService} avoids a second injectable for
 * three endpoints that already share the {@code /students} prefix.
 *
 * <h3>Endpoint coverage</h3>
 * <ul>
 *   <li>{@link #list}    → {@code GET    /v1/students}</li>
 *   <li>{@link #get}     → {@code GET    /v1/students/{publicUuid}}</li>
 *   <li>{@link #create}  → {@code POST   /v1/students}</li>
 *   <li>{@link #update}  → {@code PUT    /v1/students/{publicUuid}}</li>
 *   <li>{@link #delete}  → {@code DELETE /v1/students/{publicUuid}}</li>
 *   <li>{@link #downloadTemplate} → {@code GET  /v1/students/bulk-import/template}</li>
 *   <li>{@link #uploadBulkImport} → {@code POST /v1/students/bulk-import} (multipart)</li>
 *   <li>{@link #getBulkImportJob} → {@code GET  /v1/students/bulk-import/{publicUuid}}</li>
 * </ul>
 *
 * <p>Adapters at the bottom narrow ISO timestamps to {@link Date} and
 * surface backend nulls as {@code undefined} so consumers don't have
 * to keep ternarying their way through optional fields.
 */
@Injectable({ providedIn: 'root' })
export class StudentsApiService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  // ===========================================================================
  // CRUD
  // ===========================================================================

  /**
   * Paginated list with optional filters. Returns Spring's native
   * {@code Page<T>} envelope verbatim — same convention used by
   * {@code GET /v1/users} so pagination wiring stays uniform.
   */
  list(
    filters: StudentListFilters = {},
    pagination: StudentListPagination = {}
  ): Observable<SpringPage<StudentRow>> {
    const params: Record<string, string | number | undefined> = {
      search: filters.search?.trim() || undefined,
      enrollmentStatus: filters.enrollmentStatus,
      gradeLevelId: filters.gradeLevelId,
      page: pagination.page,
      size: pagination.size,
      sort: pagination.sort
    };

    return this.api
      .get<SpringPage<StudentListItemRaw>>(API.STUDENTS.ROOT, params)
      .pipe(map((page) => this.toStudentPage(page)));
  }

  get(publicUuid: string): Observable<StudentDetail> {
    return this.api
      .get<ApiResponse<StudentResponseRaw>>(API.STUDENTS.BY_ID(publicUuid))
      .pipe(map((envelope) => this.toStudentDetail(envelope.data)));
  }

  create(request: CreateStudentRequest): Observable<StudentDetail> {
    return this.api
      .post<ApiResponse<StudentResponseRaw>, CreateStudentRequest>(
        API.STUDENTS.ROOT,
        request
      )
      .pipe(map((envelope) => this.toStudentDetail(envelope.data)));
  }

  update(publicUuid: string, patch: UpdateStudentRequest): Observable<StudentDetail> {
    return this.api
      .put<ApiResponse<StudentResponseRaw>, UpdateStudentRequest>(
        API.STUDENTS.BY_ID(publicUuid),
        patch
      )
      .pipe(map((envelope) => this.toStudentDetail(envelope.data)));
  }

  /**
   * Soft-delete. The backend marks the row {@code deleted = true} and
   * drops it from every query; re-creating a student with the same
   * {@code (documentType, documentNumber)} pair afterwards is allowed.
   */
  delete(publicUuid: string): Observable<void> {
    return this.api.delete<void>(API.STUDENTS.BY_ID(publicUuid));
  }

  // ===========================================================================
  // Bulk import
  // ===========================================================================

  /**
   * Download the canonical {@code .xlsx} template (header row + sample
   * row + Reference sheet with allowed enums). We bypass
   * {@link ApiService} here because the response is binary and the
   * default {@code HttpClient.get<T>} call would try to JSON-parse it.
   */
  downloadTemplate(): Observable<Blob> {
    return this.http.get(API.STUDENTS.BULK_IMPORT.TEMPLATE, {
      responseType: 'blob'
    });
  }

  /**
   * Enqueue a bulk-import job from an {@code .xlsx} workbook. Backend
   * responds {@code 202 Accepted} with the freshly-created job
   * (status {@code PENDING}, counters at zero); callers poll
   * {@link #getBulkImportJob} for progress.
   */
  uploadBulkImport(file: File): Observable<BulkImportJob> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http
      .post<ApiResponse<BulkImportJobResponseRaw>>(
        API.STUDENTS.BULK_IMPORT.ROOT,
        form
      )
      .pipe(map((envelope) => this.toBulkImportJob(envelope.data)));
  }

  /**
   * Look up a job's current state. Used by the UI's progress poller.
   * Backend returns 404 RESOURCE_NOT_FOUND for unknown ids or jobs
   * belonging to another tenant — same envelope as the rest of the
   * module, so the global error handler localizes it for free.
   */
  getBulkImportJob(publicUuid: string): Observable<BulkImportJob> {
    return this.api
      .get<ApiResponse<BulkImportJobResponseRaw>>(
        API.STUDENTS.BULK_IMPORT.BY_ID(publicUuid)
      )
      .pipe(map((envelope) => this.toBulkImportJob(envelope.data)));
  }

  // ===========================================================================
  // Guardians (FE-3.5)
  // ===========================================================================

  /**
   * List the guardians currently linked to a student. Returns each
   * active link with the merged guardian profile + relationship
   * metadata; the response is a plain array (no pagination — students
   * rarely have more than a handful of guardians).
   */
  listGuardians(studentPublicUuid: string): Observable<Guardian[]> {
    return this.api
      .get<ApiResponse<GuardianResponseRaw[]>>(API.STUDENTS.GUARDIANS(studentPublicUuid))
      .pipe(map((envelope) => envelope.data.map((g) => this.toGuardian(g))));
  }

  /**
   * Add (or sibling-link) a guardian. Backend looks up an existing
   * guardian by document; reuses if found, creates otherwise. The
   * response carries the freshly persisted projection (including
   * {@code linkPublicUuid} the UI needs for subsequent edits).
   */
  addGuardian(
    studentPublicUuid: string,
    request: AddGuardianRequest
  ): Observable<Guardian> {
    return this.api
      .post<ApiResponse<GuardianResponseRaw>, AddGuardianRequest>(
        API.STUDENTS.GUARDIANS(studentPublicUuid),
        request
      )
      .pipe(map((envelope) => this.toGuardian(envelope.data)));
  }

  /**
   * Patch the relationship (only). Guardian profile fields stay
   * immutable from this endpoint — Sprint 4+ will add a guardians
   * module if admins need to rename or re-contact.
   */
  updateGuardianLink(
    studentPublicUuid: string,
    guardianPublicUuid: string,
    patch: UpdateGuardianLinkRequest
  ): Observable<Guardian> {
    return this.api
      .put<ApiResponse<GuardianResponseRaw>, UpdateGuardianLinkRequest>(
        API.STUDENTS.GUARDIAN_BY_ID(studentPublicUuid, guardianPublicUuid),
        patch
      )
      .pipe(map((envelope) => this.toGuardian(envelope.data)));
  }

  /**
   * Soft-unlink. The guardian row is preserved (it may still link to
   * a sibling). Backend returns 422 LAST_PRIMARY_CONTACT when the
   * removal would strand the student without a primary contact.
   */
  unlinkGuardian(
    studentPublicUuid: string,
    guardianPublicUuid: string
  ): Observable<void> {
    return this.api.delete<void>(
      API.STUDENTS.GUARDIAN_BY_ID(studentPublicUuid, guardianPublicUuid)
    );
  }

  // ---------------------------------------------------------------------------
  // Adapters
  // ---------------------------------------------------------------------------

  private toStudentPage(
    raw: SpringPage<StudentListItemRaw>
  ): SpringPage<StudentRow> {
    return {
      ...raw,
      content: raw.content.map((row) => this.toStudentRow(row))
    };
  }

  private toStudentRow(raw: StudentListItemRaw): StudentRow {
    return {
      publicUuid: raw.publicUuid,
      documentType: raw.documentType,
      documentNumber: raw.documentNumber,
      firstName: raw.firstName,
      lastName: raw.lastName,
      fullName: raw.fullName,
      email: raw.email ?? undefined,
      enrollmentStatus: raw.enrollmentStatus,
      enrollmentDate: this.parseDate(raw.enrollmentDate)
    };
  }

  private toStudentDetail(raw: StudentResponseRaw): StudentDetail {
    return {
      publicUuid: raw.publicUuid,
      documentType: raw.documentType,
      documentNumber: raw.documentNumber,
      firstName: raw.firstName,
      lastName: raw.lastName,
      secondLastName: raw.secondLastName ?? undefined,
      fullName: raw.fullName,
      birthDate: this.parseDate(raw.birthDate),
      gender: raw.gender ?? undefined,
      email: raw.email ?? undefined,
      phone: raw.phone ?? undefined,
      address: raw.address ?? undefined,
      enrollmentStatus: raw.enrollmentStatus,
      enrollmentDate: this.parseDate(raw.enrollmentDate),
      userId: raw.userId ?? undefined,
      metadata: raw.metadata ?? undefined,
      createdAt: this.parseDate(raw.createdAt),
      updatedAt: this.parseDate(raw.updatedAt)
    };
  }

  private toBulkImportJob(raw: BulkImportJobResponseRaw): BulkImportJob {
    return {
      publicUuid: raw.publicUuid,
      jobType: raw.jobType,
      status: raw.status,
      fileName: raw.fileName,
      fileSizeBytes: raw.fileSizeBytes,
      totalRows: raw.totalRows ?? undefined,
      processedRows: raw.processedRows,
      errorRows: raw.errorRows,
      errors: this.toRowErrors(raw.errors),
      failReason: raw.failReason ?? undefined,
      startedAt: this.parseDate(raw.startedAt),
      finishedAt: this.parseDate(raw.finishedAt),
      createdAt: this.parseDate(raw.createdAt)
    };
  }

  private toGuardian(raw: GuardianResponseRaw): Guardian {
    return {
      linkPublicUuid: raw.linkPublicUuid,
      guardianPublicUuid: raw.guardianPublicUuid,
      documentType: raw.documentType,
      documentNumber: raw.documentNumber,
      firstName: raw.firstName,
      lastName: raw.lastName,
      fullName: raw.fullName,
      email: raw.email ?? undefined,
      phone: raw.phone ?? undefined,
      occupation: raw.occupation ?? undefined,
      relationship: raw.relationship,
      isPrimaryContact: raw.isPrimaryContact,
      canPickupStudent: raw.canPickupStudent
    };
  }

  private toRowErrors(
    raw: BulkImportRowErrorRaw[] | null | undefined
  ): BulkImportRowError[] {
    if (!raw || raw.length === 0) return [];
    return raw.map((e) => ({ row: e.row, code: e.code, message: e.message }));
  }

  private parseDate(value: string | null | undefined): Date | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
}
