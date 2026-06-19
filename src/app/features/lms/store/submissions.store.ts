import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import {
  SubmissionApiService,
  UploadProgress
} from '../services';
import {
  CreateSubmissionRequest,
  GradeSubmissionRequest,
  ReturnSubmissionRequest,
  Submission,
  SubmissionRow,
  UpdateSubmissionRequest
} from '../models';

/**
 * Reactive store del feature {@code lms.submissions} (FE-7a.2).
 *
 * <h3>Slices</h3>
 * <ol>
 *   <li><b>By-assignment list</b> — grilla del TEACHER. Refleja
 *       calificaciones / devoluciones en tiempo real.</li>
 *   <li><b>By-student list</b> — "Mis entregas" para STUDENT/PARENT.</li>
 *   <li><b>My submission</b> — la submission propia del STUDENT sobre
 *       la tarea actualmente abierta (singular).</li>
 *   <li><b>Upload progress</b> — signal numérico 0..100 que la page
 *       {@code SubmissionFormComponent} bindea al {@code <progress>}.</li>
 * </ol>
 *
 * <p>Las mutaciones (create / update / grade / return) refrescan los
 * slices que contienen el row afectado, manteniendo la UI coherente
 * entre la grilla del TEACHER y la card del STUDENT (mismo row
 * visto desde dos lentes).</p>
 */
@Injectable({ providedIn: 'root' })
export class SubmissionsStore {
  private readonly api = inject(SubmissionApiService);

  // ---------- by-assignment slice (TEACHER) ----------
  private readonly _rows = signal<SubmissionRow[]>([]);
  private readonly _currentAssignmentUuid = signal<string | null>(null);
  private readonly _loading = signal<boolean>(false);

  // ---------- by-student slice (STUDENT/PARENT) ----------
  private readonly _studentRows = signal<SubmissionRow[]>([]);
  private readonly _currentStudentUuid = signal<string | null>(null);
  private readonly _loadingStudent = signal<boolean>(false);

  // ---------- my submission (singular) ----------
  private readonly _mySubmission = signal<Submission | null>(null);
  private readonly _loadingMine = signal<boolean>(false);

  // ---------- upload progress ----------
  private readonly _uploading = signal<boolean>(false);
  private readonly _uploadPercent = signal<number>(0);

  // ---------- shared ----------
  private readonly _error = signal<string | null>(null);

  // ---------- public read-only API ----------
  readonly rows = this._rows.asReadonly();
  readonly currentAssignmentUuid = this._currentAssignmentUuid.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly studentRows = this._studentRows.asReadonly();
  readonly currentStudentUuid = this._currentStudentUuid.asReadonly();
  readonly loadingStudent = this._loadingStudent.asReadonly();

  readonly mySubmission = this._mySubmission.asReadonly();
  readonly loadingMine = this._loadingMine.asReadonly();

  readonly uploading = this._uploading.asReadonly();
  readonly uploadPercent = this._uploadPercent.asReadonly();

  readonly error = this._error.asReadonly();

  readonly hasMySubmission = computed(() => this._mySubmission() !== null);

  // ===========================================================================
  // List by assignment (TEACHER)
  // ===========================================================================

  async loadByAssignment(assignmentUuid: string): Promise<void> {
    if (
      this._currentAssignmentUuid() === assignmentUuid &&
      this._rows().length > 0
    ) {
      return;
    }
    this._currentAssignmentUuid.set(assignmentUuid);
    this._loading.set(true);
    this._error.set(null);
    try {
      const rows = await firstValueFrom(this.api.listByAssignment(assignmentUuid));
      this._rows.set(rows);
    } catch {
      this._rows.set([]);
      this._error.set('No pudimos cargar las entregas de esta tarea.');
    } finally {
      this._loading.set(false);
    }
  }

  // ===========================================================================
  // List by student (STUDENT/PARENT)
  // ===========================================================================

  async loadByStudent(studentUuid: string): Promise<void> {
    if (this._currentStudentUuid() === studentUuid && this._studentRows().length > 0) {
      return;
    }
    this._currentStudentUuid.set(studentUuid);
    this._loadingStudent.set(true);
    this._error.set(null);
    try {
      const rows = await firstValueFrom(this.api.listByStudent(studentUuid));
      this._studentRows.set(rows);
    } catch {
      this._studentRows.set([]);
      this._error.set('No pudimos cargar tus entregas.');
    } finally {
      this._loadingStudent.set(false);
    }
  }

  // ===========================================================================
  // My submission (singular) — used in the STUDENT detail page
  // ===========================================================================

  /**
   * Carga la submission del student actual para la assignment dada.
   * Si el backend devuelve 404, el signal queda en null sin levantar
   * error — ese caso es la ausencia de entrega, no un fallo.
   */
  async loadMySubmission(assignmentUuid: string): Promise<Submission | null> {
    this._loadingMine.set(true);
    try {
      // Backend no expone un endpoint "by-assignment-and-student"
      // dedicado: el front itera el listing por student. Para MVP
      // dejamos el fetch del student actual en la page.
      void assignmentUuid;
      return null;
    } finally {
      this._loadingMine.set(false);
    }
  }

  setMySubmission(submission: Submission | null): void {
    this._mySubmission.set(submission);
  }

  // ===========================================================================
  // Create / Update
  // ===========================================================================

  async create(
    assignmentUuid: string,
    request: CreateSubmissionRequest
  ): Promise<Submission | null> {
    this._uploading.set(true);
    this._uploadPercent.set(0);
    this._error.set(null);
    try {
      const stream = this.api.create(assignmentUuid, request);
      const final = await drainUpload(stream, (p) => this._uploadPercent.set(p));
      this._mySubmission.set(final);
      this.refreshRowFromSubmission(final, true);
      return final;
    } catch {
      this._error.set('No pudimos registrar tu entrega. Inténtalo de nuevo.');
      return null;
    } finally {
      this._uploading.set(false);
      this._uploadPercent.set(0);
    }
  }

  async update(
    submissionUuid: string,
    request: UpdateSubmissionRequest
  ): Promise<Submission | null> {
    this._uploading.set(true);
    this._uploadPercent.set(0);
    this._error.set(null);
    try {
      const stream = this.api.update(submissionUuid, request);
      const final = await drainUpload(stream, (p) => this._uploadPercent.set(p));
      this._mySubmission.set(final);
      this.refreshRowFromSubmission(final, true);
      return final;
    } catch {
      this._error.set('No pudimos actualizar tu entrega. Inténtalo de nuevo.');
      return null;
    } finally {
      this._uploading.set(false);
      this._uploadPercent.set(0);
    }
  }

  // ===========================================================================
  // Grade / Return (TEACHER)
  // ===========================================================================

  async grade(
    submissionUuid: string,
    request: GradeSubmissionRequest
  ): Promise<Submission | null> {
    this._error.set(null);
    try {
      const updated = await firstValueFrom(this.api.grade(submissionUuid, request));
      this.refreshRowFromSubmission(updated, false);
      return updated;
    } catch {
      this._error.set('No pudimos calificar la entrega.');
      return null;
    }
  }

  async return(
    submissionUuid: string,
    request: ReturnSubmissionRequest = {}
  ): Promise<Submission | null> {
    this._error.set(null);
    try {
      const updated = await firstValueFrom(this.api.return(submissionUuid, request));
      this.refreshRowFromSubmission(updated, false);
      return updated;
    } catch {
      this._error.set('No pudimos devolver la entrega.');
      return null;
    }
  }

  // ===========================================================================
  // Errors
  // ===========================================================================

  clearError(): void {
    this._error.set(null);
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  /**
   * Mirror a submission back into whichever listing slices contain
   * a row with the same {@code publicUuid}. Bumps version/state.
   */
  private refreshRowFromSubmission(submission: Submission, bump: boolean): void {
    const inAssignment = this._rows().some((r) => r.publicUuid === submission.publicUuid);
    if (inAssignment) {
      this._rows.update((rows) =>
        rows.map((r) =>
          r.publicUuid === submission.publicUuid
            ? {
                ...r,
                status: submission.status,
                grade: submission.grade,
                hasAttachment: submission.attachment !== null,
                submittedAt: submission.submittedAt,
                version: bump ? submission.version : r.version
              }
            : r
        )
      );
    }
    const inStudent = this._studentRows().some(
      (r) => r.publicUuid === submission.publicUuid
    );
    if (inStudent) {
      this._studentRows.update((rows) =>
        rows.map((r) =>
          r.publicUuid === submission.publicUuid
            ? {
                ...r,
                status: submission.status,
                grade: submission.grade,
                hasAttachment: submission.attachment !== null,
                submittedAt: submission.submittedAt
              }
            : r
        )
      );
    }
  }
}

/**
 * Drains a multipart upload stream to its terminal event, calling
 * {@code onProgress} on each progress tick. Returns the final
 * value once a `Response` event arrives.
 */
function drainUpload<T>(
  stream: Observable<UploadProgress<T>>,
  onProgress: (percent: number) => void
): Promise<T> {
  return firstValueFrom(
    new Observable<T>((sub) => {
      const inner = stream.subscribe({
        next: (e: UploadProgress<T>) => {
          if (e.kind === 'Progress' && e.percent !== null) onProgress(e.percent);
          else if (e.kind === 'Response') {
            sub.next(e.value);
            sub.complete();
          }
        },
        error: (err: unknown) => sub.error(err),
        complete: () => sub.complete()
      });
      return () => inner.unsubscribe();
    })
  );
}
