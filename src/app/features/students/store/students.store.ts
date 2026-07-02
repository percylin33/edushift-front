import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StudentsApiService } from '../services';
import {
  AddGuardianRequest,
  BulkImportJob,
  CreateEnrollmentRequest,
  CreateStudentRequest,
  EnrollmentDetail,
  EnrollmentRow,
  Guardian,
  StudentDetail,
  StudentListFilters,
  StudentListPagination,
  StudentRow,
  UpdateGuardianLinkRequest,
  UpdateStudentRequest,
  WithdrawEnrollmentRequest,
} from '../models';
import { StudentEnrollmentStatus, isTerminalBulkImportStatus } from '@core/enums';

interface PaginationState {
  /** Zero-based page index (Spring contract). */
  page: number;
  /** Configured page size. */
  size: number;
  totalElements: number;
  totalPages: number;
}

/**
 * Reactive façade over {@link StudentsApiService} for the
 * {@code features/students} pages.
 *
 * <h3>State slices</h3>
 * <ol>
 *   <li><b>List</b> — items + filters + pagination, refreshed on
 *       filter / page changes via {@link #loadList}.</li>
 *   <li><b>Detail</b> — one selected student fetched by
 *       {@link #loadDetail}; mutations (update, delete) keep both the
 *       detail snapshot and the matching list row in sync.</li>
 *   <li><b>Bulk import</b> — the active job (if any) plus a polling
 *       loop that stops when the job hits a terminal status. Kept on
 *       the same store so the list page can surface progress next to
 *       the table without a second injectable.</li>
 * </ol>
 *
 * <p>Pages should never call {@link StudentsApiService} directly:
 * routing writes through the store keeps optimistic updates in one
 * place and avoids dropping list rows out of sync after edits.
 */
@Injectable({ providedIn: 'root' })
export class StudentsStore {
  private readonly api = inject(StudentsApiService);

  // -------- list slice --------
  private readonly _items = signal<StudentRow[]>([]);
  private readonly _filters = signal<StudentListFilters>({});
  private readonly _pagination = signal<PaginationState>({
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  });
  private readonly _loading = signal(false);

  // -------- detail slice --------
  private readonly _selected = signal<StudentDetail | null>(null);
  private readonly _loadingDetail = signal(false);
  private readonly _saving = signal(false);

  // -------- bulk import slice --------
  private readonly _bulkJob = signal<BulkImportJob | null>(null);
  private readonly _bulkUploading = signal(false);
  /** Active polling timer id; lets us cancel in {@link #resetBulkImport}. */
  private bulkPollHandle: ReturnType<typeof setTimeout> | null = null;

  // -------- guardians slice (FE-3.5) --------
  private readonly _guardians = signal<Guardian[]>([]);
  private readonly _loadingGuardians = signal(false);
  private readonly _savingGuardian = signal(false);

  // -------- enrollments slice (FE-4.7) --------
  private readonly _enrollments = signal<EnrollmentRow[]>([]);
  private readonly _loadingEnrollments = signal(false);
  private readonly _savingEnrollment = signal(false);
  /** Owner del cache; previene mostrar el historial de otro estudiante en flight. */
  private readonly _enrollmentsOwner = signal<string | null>(null);

  // -------- shared --------
  private readonly _error = signal<string | null>(null);

  readonly items = this._items.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly pagination = this._pagination.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly selected = this._selected.asReadonly();
  readonly loadingDetail = this._loadingDetail.asReadonly();
  readonly saving = this._saving.asReadonly();

  readonly bulkJob = this._bulkJob.asReadonly();
  readonly bulkUploading = this._bulkUploading.asReadonly();

  readonly guardians = this._guardians.asReadonly();
  readonly loadingGuardians = this._loadingGuardians.asReadonly();
  readonly savingGuardian = this._savingGuardian.asReadonly();

  readonly enrollments = this._enrollments.asReadonly();
  readonly loadingEnrollments = this._loadingEnrollments.asReadonly();
  readonly savingEnrollment = this._savingEnrollment.asReadonly();

  /**
   * Matrícula ACTIVE actual ({@code status === ACTIVE}). El back
   * garantiza a lo más una por (student, year) via partial unique
   * index, pero en pleno año transitorio puede haber más de una si
   * hay matrícula histórica de un año anterior re-leída por error;
   * tomamos la primera para no romper el render.
   */
  readonly activeEnrollment = computed<EnrollmentRow | null>(
    () => this._enrollments().find((e) => e.active) ?? null,
  );

  readonly error = this._error.asReadonly();

  readonly hasItems = computed(() => this._items().length > 0);
  readonly isEmpty = computed(() => !this._loading() && this._items().length === 0);

  // ===========================================================================
  // List ops
  // ===========================================================================

  async applyFilters(filters: StudentListFilters): Promise<void> {
    this._filters.set({ ...filters });
    this._pagination.update((p) => ({ ...p, page: 0 }));
    await this.loadList();
  }

  async goToPage(page: number): Promise<void> {
    const totalPages = this._pagination().totalPages;
    const clamped = Math.max(0, totalPages > 0 ? Math.min(page, totalPages - 1) : 0);
    this._pagination.update((p) => ({ ...p, page: clamped }));
    await this.loadList();
  }

  async setPageSize(size: number): Promise<void> {
    this._pagination.update((p) => ({ ...p, size, page: 0 }));
    await this.loadList();
  }

  async loadList(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    const { page, size } = this._pagination();
    const pagination: StudentListPagination = { page, size };

    try {
      const result = await firstValueFrom(this.api.list(this._filters(), pagination));
      this._items.set(result.content);
      this._pagination.set({
        page: result.number,
        size: result.size,
        totalElements: result.totalElements,
        totalPages: result.totalPages,
      });
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._items.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  // ===========================================================================
  // Detail ops
  // ===========================================================================

  async loadDetail(publicUuid: string): Promise<StudentDetail | null> {
    this._loadingDetail.set(true);
    this._error.set(null);

    try {
      const detail = await firstValueFrom(this.api.get(publicUuid));
      this._selected.set(detail);
      return detail;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._selected.set(null);
      return null;
    } finally {
      this._loadingDetail.set(false);
    }
  }

  async create(request: CreateStudentRequest): Promise<StudentDetail | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const created = await firstValueFrom(this.api.create(request));
      this._selected.set(created);
      /* Prepend the new row so the admin sees it immediately if they
       * navigate back to the list before a refresh. The pagination
       * counters lag by one until the next list reload — acceptable
       * since the list page reissues {@link #loadList} on entry. */
      this._items.update((rows) => [this.toRow(created), ...rows]);
      return created;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async update(publicUuid: string, patch: UpdateStudentRequest): Promise<StudentDetail | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const updated = await firstValueFrom(this.api.update(publicUuid, patch));
      this._selected.set(updated);
      this.upsertRow(updated);
      return updated;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async delete(publicUuid: string): Promise<boolean> {
    this._saving.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(this.api.delete(publicUuid));
      this._items.update((rows) => rows.filter((r) => r.publicUuid !== publicUuid));
      if (this._selected()?.publicUuid === publicUuid) {
        this._selected.set(null);
      }
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  // ===========================================================================
  // Bulk import
  // ===========================================================================

  /**
   * Trigger the template download. Returns the {@link Blob} so the
   * caller can pipe it into an anchor + URL.createObjectURL — UI
   * decisions (filename suggestion, click side-effects) belong in the
   * component, not the store.
   */
  async downloadTemplate(): Promise<Blob | null> {
    this._error.set(null);
    try {
      return await firstValueFrom(this.api.downloadTemplate());
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    }
  }

  /**
   * Upload an {@code .xlsx} workbook and start polling. The job
   * publishes its progress through {@link #bulkJob}; the poller exits
   * automatically when the status hits {@code COMPLETED} / {@code FAILED}.
   */
  async startBulkImport(file: File): Promise<BulkImportJob | null> {
    this.cancelBulkPolling();
    this._bulkUploading.set(true);
    this._error.set(null);

    try {
      const job = await firstValueFrom(this.api.uploadBulkImport(file));
      this._bulkJob.set(job);
      if (!isTerminalBulkImportStatus(job.status)) {
        this.scheduleBulkPoll(job.publicUuid);
      }
      return job;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._bulkUploading.set(false);
    }
  }

  // ===========================================================================
  // Guardians (FE-3.5)
  // ===========================================================================

  /**
   * Load the guardians of the given student. Resets the slice on
   * failure so a stale list from a previous student doesn't bleed
   * into the current detail page.
   */
  async loadGuardians(studentPublicUuid: string): Promise<void> {
    this._loadingGuardians.set(true);
    this._error.set(null);

    try {
      const guardians = await firstValueFrom(this.api.listGuardians(studentPublicUuid));
      this._guardians.set(guardians);
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._guardians.set([]);
    } finally {
      this._loadingGuardians.set(false);
    }
  }

  /**
   * Add (or sibling-link) a guardian and append it to the slice. We
   * append rather than refetch because the backend response carries
   * the full projection — saves a network round-trip and keeps the
   * UI snappy after submit.
   */
  async addGuardian(
    studentPublicUuid: string,
    request: AddGuardianRequest,
  ): Promise<Guardian | null> {
    this._savingGuardian.set(true);
    this._error.set(null);

    try {
      const guardian = await firstValueFrom(this.api.addGuardian(studentPublicUuid, request));
      /* If the new guardian was promoted to primary, demote any
       * existing primary so the local view matches the backend
       * (which handles the swap server-side). The other contact
       * fields are unaffected. */
      if (guardian.isPrimaryContact) {
        this._guardians.update((list) =>
          list.map((g) =>
            g.linkPublicUuid === guardian.linkPublicUuid ? g : { ...g, isPrimaryContact: false },
          ),
        );
      }
      this._guardians.update((list) => [...list, guardian]);
      return guardian;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._savingGuardian.set(false);
    }
  }

  /**
   * Patch a link (relationship + primary/canPickup flags). Replaces
   * the row in place to avoid jitter; if the target was promoted to
   * primary, demotes any existing primary in the snapshot for parity
   * with the server-side swap.
   */
  async updateGuardianLink(
    studentPublicUuid: string,
    guardianPublicUuid: string,
    patch: UpdateGuardianLinkRequest,
  ): Promise<Guardian | null> {
    this._savingGuardian.set(true);
    this._error.set(null);

    try {
      const updated = await firstValueFrom(
        this.api.updateGuardianLink(studentPublicUuid, guardianPublicUuid, patch),
      );
      this._guardians.update((list) =>
        list.map((g) => {
          if (g.linkPublicUuid === updated.linkPublicUuid) return updated;
          if (updated.isPrimaryContact) {
            return { ...g, isPrimaryContact: false };
          }
          return g;
        }),
      );
      return updated;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._savingGuardian.set(false);
    }
  }

  async unlinkGuardian(
    studentPublicUuid: string,
    guardianPublicUuid: string,
    linkPublicUuid: string,
  ): Promise<boolean> {
    this._savingGuardian.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(this.api.unlinkGuardian(studentPublicUuid, guardianPublicUuid));
      this._guardians.update((list) => list.filter((g) => g.linkPublicUuid !== linkPublicUuid));
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    } finally {
      this._savingGuardian.set(false);
    }
  }

  // ===========================================================================
  // Enrollments (FE-4.7)
  // ===========================================================================

  /**
   * Carga el historial completo (ACTIVE + terminales) del estudiante,
   * cacheado en {@link #enrollments}. El cache se invalida en
   * {@link #clearEnrollments} y al cambiar el {@code studentPublicUuid}.
   */
  async loadEnrollments(studentPublicUuid: string): Promise<void> {
    /* Guard contra carreras: si el caller cambia de student mientras
     * está en flight, descartamos la respuesta vieja. */
    this._enrollmentsOwner.set(studentPublicUuid);
    this._loadingEnrollments.set(true);
    this._error.set(null);

    try {
      const rows = await firstValueFrom(this.api.listEnrollments(studentPublicUuid));
      if (this._enrollmentsOwner() === studentPublicUuid) {
        this._enrollments.set(rows);
      }
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      if (this._enrollmentsOwner() === studentPublicUuid) {
        this._enrollments.set([]);
      }
    } finally {
      this._loadingEnrollments.set(false);
    }
  }

  /**
   * Crea una matrícula. Refresca el historial post-creación para
   * que las dos rows (la nueva ACTIVE y la previa terminada por el
   * back si se hizo dual-write) queden consistentes.
   */
  async enrollStudent(
    studentPublicUuid: string,
    request: CreateEnrollmentRequest,
  ): Promise<EnrollmentDetail | null> {
    this._savingEnrollment.set(true);
    this._error.set(null);

    try {
      const created = await firstValueFrom(this.api.createEnrollment(studentPublicUuid, request));
      /* Refrescamos en lugar de prepend manual: el back puede haber
       * cerrado otras rows (ej. status del student que pasa a
       * ENROLLED) y solo el list garantiza el orden correcto. */
      await this.loadEnrollments(studentPublicUuid);
      /* Re-fetch del detail para que el row del padrón refleje el
       * status actualizado (si aplica). */
      if (this._selected()?.publicUuid === studentPublicUuid) {
        await this.loadDetail(studentPublicUuid);
      }
      return created;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._savingEnrollment.set(false);
    }
  }

  /**
   * Soft-end de una matrícula. Actualiza optimistamente el row en
   * el cache (transición {@code active: true → false},
   * {@code status} ← request.status, {@code withdrawnAt} ← request.withdrawnAt)
   * antes de la respuesta del back.
   */
  async withdrawEnrollment(
    enrollmentPublicUuid: string,
    request: WithdrawEnrollmentRequest,
  ): Promise<EnrollmentDetail | null> {
    this._savingEnrollment.set(true);
    this._error.set(null);

    try {
      const result = await firstValueFrom(
        this.api.withdrawEnrollment(enrollmentPublicUuid, request),
      );
      this._enrollments.update((rows) =>
        rows.map((r) =>
          r.publicUuid === enrollmentPublicUuid
            ? {
                ...r,
                status: result.status,
                active: result.active,
                withdrawnAt: result.withdrawnAt,
              }
            : r,
        ),
      );
      return result;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._savingEnrollment.set(false);
    }
  }

  /**
   * Cambio de sección: encadena {@link #withdrawEnrollment} (status
   * {@code TRANSFERRED}) sobre la matrícula activa con
   * {@link #enrollStudent} para la nueva sección. Si la primera
   * mutación falla, la segunda no se ejecuta y devolvemos
   * {@code null}; si la primera tiene éxito y la segunda falla, el
   * back queda con la row activa terminada y la nueva sin crear —
   * el caller decide si reintenta o muestra un alert al usuario.
   */
  async transferStudentSection(
    studentPublicUuid: string,
    activeEnrollmentPublicUuid: string,
    transferDate: string,
    create: CreateEnrollmentRequest,
  ): Promise<EnrollmentDetail | null> {
    const withdrawn = await this.withdrawEnrollment(activeEnrollmentPublicUuid, {
      status: StudentEnrollmentStatus.Transferred,
      withdrawnAt: transferDate,
    });
    if (!withdrawn) return null;
    return this.enrollStudent(studentPublicUuid, create);
  }

  clearEnrollments(): void {
    this._enrollments.set([]);
    this._enrollmentsOwner.set(null);
  }

  /** Manually re-poll the active job (e.g. on a "Refresh" button). */
  async refreshBulkJob(): Promise<void> {
    const current = this._bulkJob();
    if (!current) return;
    await this.pollBulkJobOnce(current.publicUuid);
  }

  /**
   * Tear down the bulk-import slice (active job + poller) without
   * touching the rest of the store. Called when the modal closes or
   * the admin starts a new import.
   */
  resetBulkImport(): void {
    this.cancelBulkPolling();
    this._bulkJob.set(null);
    this._bulkUploading.set(false);
  }

  clearError(): void {
    this._error.set(null);
  }

  reset(): void {
    this._items.set([]);
    this._filters.set({});
    this._pagination.set({ page: 0, size: 20, totalElements: 0, totalPages: 0 });
    this._loading.set(false);
    this._selected.set(null);
    this._loadingDetail.set(false);
    this._saving.set(false);
    this._error.set(null);
    this._guardians.set([]);
    this._loadingGuardians.set(false);
    this._savingGuardian.set(false);
    this._enrollments.set([]);
    this._enrollmentsOwner.set(null);
    this._loadingEnrollments.set(false);
    this._savingEnrollment.set(false);
    this.resetBulkImport();
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private upsertRow(detail: StudentDetail): void {
    this._items.update((rows) => {
      const idx = rows.findIndex((r) => r.publicUuid === detail.publicUuid);
      const next = rows.slice();
      const row = this.toRow(detail);
      if (idx < 0) {
        next.unshift(row);
      } else {
        next[idx] = row;
      }
      return next;
    });
  }

  private toRow(detail: StudentDetail): StudentRow {
    return {
      publicUuid: detail.publicUuid,
      documentType: detail.documentType,
      documentNumber: detail.documentNumber,
      firstName: detail.firstName,
      lastName: detail.lastName,
      fullName: detail.fullName,
      email: detail.email,
      enrollmentStatus: detail.enrollmentStatus,
      enrollmentDate: detail.enrollmentDate,
    };
  }

  /**
   * Schedule the next poll. We use {@code setTimeout} (not RxJS
   * {@code interval}) so the cycle is trivially cancellable and the
   * delay can be tuned per-tick later (e.g. backoff after errors).
   */
  private scheduleBulkPoll(publicUuid: string): void {
    this.bulkPollHandle = setTimeout(() => {
      void this.pollBulkJobOnce(publicUuid).then(() => {
        const next = this._bulkJob();
        if (next && !isTerminalBulkImportStatus(next.status)) {
          this.scheduleBulkPoll(publicUuid);
        }
      });
    }, 1500);
  }

  private async pollBulkJobOnce(publicUuid: string): Promise<void> {
    try {
      const job = await firstValueFrom(this.api.getBulkImportJob(publicUuid));
      this._bulkJob.set(job);
      if (isTerminalBulkImportStatus(job.status)) {
        /* Refresh the list once on success so newly-imported rows are
         * visible without the admin having to reload the page. We
         * intentionally don't await: the poller's job is to update the
         * progress signal, not to coordinate the table fetch. */
        if (job.status === 'COMPLETED' && job.processedRows > 0) {
          void this.loadList();
        }
      }
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this.cancelBulkPolling();
    }
  }

  private cancelBulkPolling(): void {
    if (this.bulkPollHandle !== null) {
      clearTimeout(this.bulkPollHandle);
      this.bulkPollHandle = null;
    }
  }

  private toErrorMessage(err: unknown): string {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const anyErr = err as { message?: unknown; error?: { message?: unknown } };
      if (typeof anyErr.error?.message === 'string') return anyErr.error.message;
      if (typeof anyErr.message === 'string') return anyErr.message;
    }
    return 'Ocurrió un error inesperado.';
  }
}
