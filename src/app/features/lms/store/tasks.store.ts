import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../services';
import {
  CreateTaskRequest,
  TaskDetail,
  TaskLifecycle,
  TaskRow,
  UpdateTaskRequest,
} from '../models';

/**
 * Reactive store del feature {@code lms.tasks} (FE-7a.1).
 *
 * <h3>Slices</h3>
 * <ol>
 *   <li><b>By-section list</b> — la grilla del TEACHER.
 *       Mantiene {@link #_currentSectionUuid} para que cambios de
 *       filtro re-fetcheen sobre la misma sección sin volver a
 *       pasar el id.</li>
 *   <li><b>By-student list</b> — la grilla de "Mis tareas" para
 *       STUDENT/PARENT (FE-7a.1 Scenario 4).</li>
 *   <li><b>Selected detail</b> — el task abierto en detail. Se
 *       actualiza en cada lifecycle hop (publish / close).</li>
 * </ol>
 *
 * <p>Los tres slices son independientes: cargar el listing de la
 * sección no contamina la selección del detail, y viceversa.
 * Mutaciones (create / update / publish / close) refrescan tanto el
 * listing (si la sección está abierta) como el detail (si el uuid
 * coincide).</p>
 */
@Injectable({ providedIn: 'root' })
export class TasksStore {
  private readonly api = inject(TaskApiService);

  // ---------------------------------------------------------------------------
  // List-by-section slice (TEACHER)
  // ---------------------------------------------------------------------------
  private readonly _rows = signal<TaskRow[]>([]);
  private readonly _filters = signal<{ lifecycle?: TaskLifecycle }>({});
  private readonly _currentSectionUuid = signal<string | null>(null);
  private readonly _loading = signal<boolean>(false);

  // ---------------------------------------------------------------------------
  // List-by-student slice (STUDENT / PARENT)
  // ---------------------------------------------------------------------------
  private readonly _studentRows = signal<TaskRow[]>([]);
  private readonly _currentStudentUuid = signal<string | null>(null);
  private readonly _loadingStudent = signal<boolean>(false);

  // ---------------------------------------------------------------------------
  // Detail slice
  // ---------------------------------------------------------------------------
  private readonly _selected = signal<TaskDetail | null>(null);
  private readonly _loadingDetail = signal<boolean>(false);

  // ---------------------------------------------------------------------------
  // Shared
  // ---------------------------------------------------------------------------
  private readonly _saving = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // ---------------------------------------------------------------------------
  // Public read-only API
  // ---------------------------------------------------------------------------
  readonly rows = this._rows.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly currentSectionUuid = this._currentSectionUuid.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly studentRows = this._studentRows.asReadonly();
  readonly currentStudentUuid = this._currentStudentUuid.asReadonly();
  readonly loadingStudent = this._loadingStudent.asReadonly();

  readonly selected = this._selected.asReadonly();
  readonly loadingDetail = this._loadingDetail.asReadonly();

  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();

  readonly isEmpty = computed(() => !this._loading() && this._rows().length === 0);
  readonly isStudentEmpty = computed(
    () => !this._loadingStudent() && this._studentRows().length === 0,
  );

  // ---------------------------------------------------------------------------
  // List by section
  // ---------------------------------------------------------------------------

  /**
   * Carga el listing de una sección. Si ya hay un listing activo y
   * los filtros coinciden, no vuelve a fetchear. Si difieren,
   * reemplaza en sitio.
   */
  async loadBySection(
    sectionUuid: string,
    filters: { lifecycle?: TaskLifecycle } = {},
  ): Promise<void> {
    const sameSection = this._currentSectionUuid() === sectionUuid;
    const sameFilter = this._filters().lifecycle === (filters.lifecycle ?? undefined);
    if (sameSection && sameFilter && this._rows().length > 0) return;

    this._currentSectionUuid.set(sectionUuid);
    this._filters.set(filters);
    this._loading.set(true);
    this._error.set(null);
    try {
      const rows = await firstValueFrom(this.api.listBySection(sectionUuid, filters));
      this._rows.set(rows);
    } catch {
      this._rows.set([]);
      this._error.set('No pudimos cargar las tareas de la sección.');
    } finally {
      this._loading.set(false);
    }
  }

  setLifecycleFilter(lifecycle: TaskLifecycle | undefined): void {
    const section = this._currentSectionUuid();
    if (!section) return;
    void this.loadBySection(section, { lifecycle });
  }

  // ---------------------------------------------------------------------------
  // List by student
  // ---------------------------------------------------------------------------

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
      this._error.set('No pudimos cargar tus tareas.');
    } finally {
      this._loadingStudent.set(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Detail
  // ---------------------------------------------------------------------------

  async loadDetail(publicUuid: string): Promise<TaskDetail | null> {
    this._loadingDetail.set(true);
    this._error.set(null);
    try {
      const detail = await firstValueFrom(this.api.getTask(publicUuid));
      this._selected.set(detail);
      return detail;
    } catch {
      this._selected.set(null);
      this._error.set('No pudimos cargar la tarea. Es posible que haya sido eliminada.');
      return null;
    } finally {
      this._loadingDetail.set(false);
    }
  }

  clearDetail(): void {
    this._selected.set(null);
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  async createTask(request: CreateTaskRequest): Promise<TaskDetail | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const created = await firstValueFrom(this.api.createTask(request));
      this._selected.set(created);
      this.refreshRowFromDetail(created);
      return created;
    } catch {
      this._error.set('No pudimos crear la tarea. Revisa los datos e inténtalo de nuevo.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async updateTask(publicUuid: string, patch: UpdateTaskRequest): Promise<TaskDetail | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const updated = await firstValueFrom(this.api.updateTask(publicUuid, patch));
      this._selected.set(updated);
      this.refreshRowFromDetail(updated);
      return updated;
    } catch {
      this._error.set('No pudimos guardar los cambios.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async publishTask(publicUuid: string): Promise<TaskDetail | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const published = await firstValueFrom(this.api.publishTask(publicUuid));
      this._selected.set(published);
      this.refreshRowFromDetail(published);
      return published;
    } catch {
      this._error.set('No pudimos publicar la tarea. Verifica que tenga fecha de entrega.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async closeTask(publicUuid: string): Promise<TaskDetail | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const closed = await firstValueFrom(this.api.closeTask(publicUuid));
      this._selected.set(closed);
      this.refreshRowFromDetail(closed);
      return closed;
    } catch {
      this._error.set('No pudimos cerrar la tarea.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  clearError(): void {
    this._error.set(null);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * After a mutation, mirror the resulting detail back into whichever
   * listing slices contain a row with the same {@code publicUuid}. If
   * the listing is on a different section the row is left alone
   * (it will be re-fetched when the user navigates to the right one).
   */
  private refreshRowFromDetail(detail: TaskDetail): void {
    const inSection = this._rows().some((r) => r.publicUuid === detail.publicUuid);
    if (inSection) {
      this._rows.update((rows) =>
        rows.map((r) =>
          r.publicUuid === detail.publicUuid
            ? {
                ...r,
                title: detail.title,
                dueAt: detail.dueAt,
                maxScore: detail.maxScore,
                lifecycle: detail.lifecycle,
                submissionsCount: detail.submissionsCount,
              }
            : r,
        ),
      );
    }
    const inStudent = this._studentRows().some((r) => r.publicUuid === detail.publicUuid);
    if (inStudent) {
      this._studentRows.update((rows) =>
        rows.map((r) =>
          r.publicUuid === detail.publicUuid
            ? { ...r, title: detail.title, dueAt: detail.dueAt, maxScore: detail.maxScore }
            : r,
        ),
      );
    }
  }
}
