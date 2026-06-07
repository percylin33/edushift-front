import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TeachersApiService } from '../services';
import {
  AssignmentDetail,
  AssignmentListFilters,
  AssignmentRow,
  CreateAssignmentRequest,
  SectionTeacherItem,
  SectionTeachersFilters
} from '../models';

/**
 * Reactive store específico para el sub-módulo
 * {@code teachers/assignments} (FE-4.7).
 *
 * <h3>Por qué un store separado</h3>
 * <p>El feature {@code teachers} ya tiene {@link TeachersStore} para
 * el padrón. Las assignments son un aggregate distinto con su propio
 * lifecycle (creación + soft-end), filtros (active/period) y pueden
 * ser leídos desde dos contextos: tab "Asignaciones" del teacher-detail
 * y tab "Docentes" del section-detail. Tenerlas en su propio store
 * con dos slices ({@code teacherAssignments} + {@code sectionTeachers})
 * mantiene el {@link TeachersStore} enfocado y evita coupling cruzado
 * entre los dos contextos de lectura.</p>
 *
 * <h3>Slices</h3>
 * <ol>
 *   <li><b>Teacher's assignments</b> — la list que se ve en el tab
 *       del teacher-detail. {@link #loadAssignmentsFor} las carga
 *       con filtros (period, active).</li>
 *   <li><b>Section's teachers (reverse view)</b> — qué docentes están
 *       asignados a una sección. {@link #loadSectionTeachers} la
 *       fetchea on-demand desde el tab Docentes de section-detail.</li>
 * </ol>
 */
@Injectable({ providedIn: 'root' })
export class TeacherAssignmentsStore {
  private readonly api = inject(TeachersApiService);

  // -------- assignments slice (per teacher) --------
  private readonly _assignments = signal<AssignmentRow[]>([]);
  private readonly _filters = signal<AssignmentListFilters>({ active: true });
  /** Teacher cargado actualmente; permite re-fetch sin pasar el id otra vez. */
  private readonly _currentTeacherUuid = signal<string | null>(null);
  private readonly _loading = signal<boolean>(false);
  private readonly _saving = signal<boolean>(false);

  // -------- section teachers slice (reverse view) --------
  private readonly _sectionTeachers = signal<SectionTeacherItem[]>([]);
  private readonly _currentSectionUuid = signal<string | null>(null);
  private readonly _loadingSection = signal<boolean>(false);

  // -------- shared --------
  private readonly _error = signal<string | null>(null);

  readonly assignments = this._assignments.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();

  readonly sectionTeachers = this._sectionTeachers.asReadonly();
  readonly loadingSection = this._loadingSection.asReadonly();

  readonly error = this._error.asReadonly();

  readonly hasAssignments = computed(() => this._assignments().length > 0);
  readonly isAssignmentsEmpty = computed(
    () => !this._loading() && this._assignments().length === 0
  );

  // ===========================================================================
  // Teacher's assignments
  // ===========================================================================

  /**
   * Carga las assignments del docente con los filtros vigentes.
   * Setea {@link #_currentTeacherUuid} para que cambios de filtro
   * post-carga hagan re-fetch sobre el mismo teacher.
   */
  async loadAssignmentsFor(
    teacherPublicUuid: string,
    filters: AssignmentListFilters = {}
  ): Promise<void> {
    this._currentTeacherUuid.set(teacherPublicUuid);
    /* {@code active = true} es el default del back; sólo lo
     * sobreescribimos si el caller pasa explícito. */
    this._filters.set({ active: true, ...filters });
    await this.fetchAssignments();
  }

  async setActiveFilter(active: boolean): Promise<void> {
    this._filters.update((f) => ({ ...f, active }));
    await this.fetchAssignments();
  }

  async setPeriodFilter(periodId: string | undefined): Promise<void> {
    this._filters.update((f) => ({ ...f, periodId }));
    await this.fetchAssignments();
  }

  async create(
    teacherPublicUuid: string,
    request: CreateAssignmentRequest
  ): Promise<AssignmentDetail | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const created = await firstValueFrom(
        this.api.createAssignment(teacherPublicUuid, request)
      );
      /* Si el teacher cargado coincide con el del create, prepend la
       * row para que aparezca inmediatamente sin refetch. */
      if (this._currentTeacherUuid() === teacherPublicUuid) {
        this._assignments.update((rows) => [
          this.toRow(created),
          ...rows
        ]);
      }
      return created;
    }
    catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    }
    finally {
      this._saving.set(false);
    }
  }

  /**
   * Soft-end. Marca la row como inactiva localmente (transición
   * {@code active: true → false} con {@code unassignedAt = ahora})
   * y, si el filtro vigente es {@code active: true}, la elimina del
   * snapshot para mantener la UX coherente.
   */
  async softEnd(publicUuid: string): Promise<boolean> {
    this._saving.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(this.api.softEndAssignment(publicUuid));

      const showActiveOnly = this._filters().active !== false;
      const now = new Date();

      this._assignments.update((rows) => {
        if (showActiveOnly) {
          return rows.filter((r) => r.publicUuid !== publicUuid);
        }
        return rows.map((r) =>
          r.publicUuid === publicUuid
            ? { ...r, active: false, unassignedAt: now }
            : r
        );
      });
      return true;
    }
    catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    }
    finally {
      this._saving.set(false);
    }
  }

  // ===========================================================================
  // Section's teachers (reverse view)
  // ===========================================================================

  async loadSectionTeachers(
    sectionPublicUuid: string,
    filters: SectionTeachersFilters = {}
  ): Promise<void> {
    this._currentSectionUuid.set(sectionPublicUuid);
    this._loadingSection.set(true);
    this._error.set(null);

    try {
      const rows = await firstValueFrom(
        this.api.listSectionTeachers(sectionPublicUuid, filters)
      );
      this._sectionTeachers.set(rows);
    }
    catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._sectionTeachers.set([]);
    }
    finally {
      this._loadingSection.set(false);
    }
  }

  // ===========================================================================
  // Lifecycle helpers
  // ===========================================================================

  clearAssignments(): void {
    this._assignments.set([]);
    this._currentTeacherUuid.set(null);
    this._filters.set({ active: true });
  }

  clearSectionTeachers(): void {
    this._sectionTeachers.set([]);
    this._currentSectionUuid.set(null);
  }

  clearError(): void {
    this._error.set(null);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async fetchAssignments(): Promise<void> {
    const uuid = this._currentTeacherUuid();
    if (!uuid) return;

    this._loading.set(true);
    this._error.set(null);

    try {
      const rows = await firstValueFrom(
        this.api.listAssignments(uuid, this._filters())
      );
      this._assignments.set(rows);
    }
    catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._assignments.set([]);
    }
    finally {
      this._loading.set(false);
    }
  }

  private toRow(detail: AssignmentDetail): AssignmentRow {
    return {
      publicUuid: detail.publicUuid,
      teacherPublicUuid: detail.teacherPublicUuid,
      teacherFullName: detail.teacherFullName,
      sectionPublicUuid: detail.sectionPublicUuid,
      sectionName: detail.sectionName,
      coursePublicUuid: detail.coursePublicUuid,
      courseCode: detail.courseCode,
      courseName: detail.courseName,
      academicPeriodPublicUuid: detail.academicPeriodPublicUuid,
      periodType: detail.periodType,
      periodOrdinal: detail.periodOrdinal,
      assignedAt: detail.assignedAt,
      unassignedAt: detail.unassignedAt,
      active: detail.active
    };
  }

  private toErrorMessage(err: unknown): string {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const anyErr = err as {
        message?: unknown;
        error?: { message?: unknown };
      };
      if (typeof anyErr.error?.message === 'string')
        return anyErr.error.message;
      if (typeof anyErr.message === 'string') return anyErr.message;
    }
    return 'Ocurrió un error inesperado.';
  }
}
