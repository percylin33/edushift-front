import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, startWith } from 'rxjs/operators';
import { ROUTES } from '@core/constants';
import { Permission, UserRole } from '@core/enums';
import { AuthService } from '@core/services';
import { EmptyStateComponent, IconComponent } from '@shared/components';
import { HasPermissionDirective } from '@shared/directives';
import { TasksStore } from '../../store';
import { TaskLifecycle, ALL_TASK_LIFECYCLES } from '../../models';
import { TaskLifecycleBadgeComponent } from '../../components';

/**
 * `/lms/sections/:sectionUuid/assignments` — listing del TEACHER
 * (FE-7a.1 Scenario 1).
 *
 * <h3>Responsabilidades</h3>
 * <ul>
 *   <li>Cargar el listing de la sección vía {@link TasksStore}.</li>
 *   <li>Filtro por lifecycle (DRAFT / PUBLISHED / CLOSED / Todos).</li>
 *   <li>Cada card expone acciones contextuales vía `*appHasPermission`:
 *       editar (DRAFT o antes de {@code dueAt}), publicar (DRAFT),
 *       cerrar (PUBLISHED).</li>
 *   <li>Empty state contextual: "Crear primer assignment" si es
 *       TEACHER; "No tienes tareas pendientes" si es STUDENT.</li>
 * </ul>
 *
 * <h3>RBAC</h3>
 * El {@code canMatch: [permissionGuard]} con {@code LMS_TASK_READ} ya
 * se aplicó en {@code lms.routes.ts}; aquí la directiva cubre el caso
 * "el botón Crear aparece sólo para TEACHER/ADMIN" (LMS_TASK_CREATE) y
 * "Publicar/Cerrar" (no modelado como authority distinto — viven bajo
 * LMS_TASK_CREATE; el backend los enforces por separado).
 */
@Component({
  selector: 'app-tasks-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IconComponent,
    EmptyStateComponent,
    HasPermissionDirective,
    TaskLifecycleBadgeComponent,
  ],
  template: `
    <header class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <h1 class="text-2xl font-semibold text-content">Tareas de la sección</h1>
        <p class="text-sm text-content-muted">
          Gestiona las asignaciones que ven los alumnos enrolados.
        </p>
      </div>

      <a
        *appHasPermission="permission.LmsTaskCreate"
        [routerLink]="newTaskLink()"
        [queryParams]="newTaskQuery()"
        class="btn btn-primary btn-sm self-start sm:self-auto"
      >
        <app-icon name="plus" [size]="16" />
        <span class="hidden sm:inline">Nueva tarea</span>
      </a>
    </header>

    <!-- Filtros -->
    <section class="card mb-4">
      <div class="card-body grid gap-3 sm:grid-cols-12">
        <div class="sm:col-span-4">
          <label class="label" for="tasks-lifecycle">Estado</label>
          <select
            id="tasks-lifecycle"
            class="select"
            [ngModel]="lifecycleFilter()"
            (ngModelChange)="onLifecycleChange($event)"
          >
            <option [ngValue]="undefined">Todos</option>
            @for (lc of lifecycles; track lc) {
              <option [ngValue]="lc">{{ lifecycleLabel(lc) }}</option>
            }
          </select>
        </div>
      </div>
    </section>

    <!-- Loading skeleton -->
    @if (loading()) {
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        @for (i of [0, 1, 2, 3, 4, 5]; track i) {
          <div class="card animate-pulse">
            <div class="card-body space-y-2">
              <div class="h-4 w-2/3 rounded bg-surface-muted"></div>
              <div class="h-3 w-1/3 rounded bg-surface-muted"></div>
              <div class="h-3 w-1/2 rounded bg-surface-muted"></div>
            </div>
          </div>
        }
      </div>
    } @else if (errorBanner()) {
      <div class="alert alert-danger mb-4" role="alert">
        <app-icon name="alert-circle" [size]="18" />
        <div class="flex-1">
          <p class="font-medium">No pudimos cargar las tareas.</p>
          <p class="mt-1 text-xs opacity-80">{{ errorBanner() }}</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" (click)="reload()">
          <app-icon name="refresh" [size]="14" />
          Reintentar
        </button>
      </div>
    } @else if (rows().length === 0) {
      <app-empty-state
        [title]="emptyTitle()"
        [description]="emptyDescription()"
        [icon]="'clipboard-list'"
      >
        <a
          *appHasPermission="permission.LmsTaskCreate"
          [routerLink]="newTaskLink()"
          [queryParams]="newTaskQuery()"
          class="btn btn-primary btn-sm"
        >
          <app-icon name="plus" [size]="16" />
          Crear primera tarea
        </a>
      </app-empty-state>
    } @else {
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        @for (row of rows(); track row.publicUuid) {
          <article
            class="card transition-shadow focus-within:ring-2 focus-within:ring-primary hover:shadow-md"
          >
            <div class="card-body space-y-3">
              <header class="flex items-start justify-between gap-2">
                <h2 class="text-base font-semibold text-content">
                  <button
                    type="button"
                    class="text-left hover:underline focus:outline-none"
                    (click)="onOpenDetail(row.publicUuid)"
                  >
                    {{ row.title }}
                  </button>
                </h2>
                <app-task-lifecycle-badge [lifecycle]="row.lifecycle" />
              </header>

              <dl class="grid grid-cols-2 gap-2 text-xs text-content-muted">
                <div>
                  <dt class="font-medium text-content">Vence</dt>
                  <dd>{{ row.dueAt ? (row.dueAt | date: 'medium') : '—' }}</dd>
                </div>
                <div>
                  <dt class="font-medium text-content">Puntaje máx.</dt>
                  <dd>{{ row.maxScore }}</dd>
                </div>
                <div>
                  <dt class="font-medium text-content">Entregas</dt>
                  <dd>{{ row.submissionsCount }}</dd>
                </div>
                <div>
                  <dt class="font-medium text-content">Revisadas</dt>
                  <dd>{{ row.gradedSubmissionsCount }}</dd>
                </div>
                @if (row.courseName || row.courseLabel) {
                  <div>
                    <dt class="font-medium text-content">Curso</dt>
                    <dd>
                      {{ row.courseName || row.courseLabel }}
                      @if (row.periodLabel) {
                        <span class="text-content-subtle"> · {{ row.periodLabel }}</span>
                      }
                    </dd>
                  </div>
                }
              </dl>

              <footer class="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  (click)="onOpenDetail(row.publicUuid)"
                >
                  Ver detalle
                </button>
                @if (row.lifecycle === taskLifecycle.Draft) {
                  <button
                    *appHasPermission="permission.LmsTaskCreate"
                    type="button"
                    class="btn btn-primary btn-sm"
                    [disabled]="saving()"
                    (click)="onPublish(row.publicUuid)"
                  >
                    <app-icon name="send" [size]="14" />
                    Publicar
                  </button>
                }
                <button
                  *appHasPermission="permission.LmsTaskGrade"
                  type="button"
                  class="btn btn-ghost btn-sm"
                  (click)="onOpenGrade(row.publicUuid)"
                >
                  Calificar
                </button>
              </footer>
            </div>
          </article>
        }
      </div>
    }
  `,
})
export class TasksListComponent implements OnInit {
  private readonly store = inject(TasksStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rows = this.store.rows;
  protected readonly loading = this.store.loading;
  protected readonly saving = this.store.saving;
  protected readonly errorBanner = this.store.error;
  protected readonly permission = Permission;
  protected readonly lifecycles = ALL_TASK_LIFECYCLES;
  protected readonly taskLifecycle = TaskLifecycle;

  /** Locally-tracked value for the `[(ngModel)]` two-way binding. */
  private readonly _lifecycleFilter = signal<TaskLifecycle | undefined>(undefined);
  protected readonly lifecycleFilter = this._lifecycleFilter.asReadonly();

  #sectionUuid: string | null = null;
  #assignmentUuid: string | null = null;

  ngOnInit(): void {
    // Wait for NavigationEnd so section path + assignment query are consistent
    // (combineLatest can emit mid-navigation with old section + new assignment).
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        startWith(null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.#syncFromRoute());
  }

  #syncFromRoute(): void {
    if (!/\/lms\/sections\/[^/?#]+\/assignments/.test(this.router.url)) {
      return;
    }
    const sectionUuid = this.route.snapshot.paramMap.get('sectionUuid');
    if (!sectionUuid || sectionUuid === '_') {
      void this.router.navigate([ROUTES.DASHBOARD.ROOT]);
      return;
    }
    const assignment = this.route.snapshot.queryParamMap.get('assignment');
    const sectionChanged = sectionUuid !== this.#sectionUuid;
    const assignmentChanged = assignment !== this.#assignmentUuid;
    if (!sectionChanged && !assignmentChanged && this.#sectionUuid) return;
    this.#sectionUuid = sectionUuid;
    this.#assignmentUuid = assignment;
    void this.store.loadBySection(sectionUuid, {
      lifecycle: this._lifecycleFilter(),
      assignmentPublicUuid: assignment ?? undefined,
    });
  }

  protected newTaskLink(): string[] {
    return ['/lms', 'assignments', 'new'];
  }

  protected newTaskQuery(): { section: string; assignment?: string } | null {
    if (!this.#sectionUuid) return null;
    return this.#assignmentUuid
      ? { section: this.#sectionUuid, assignment: this.#assignmentUuid }
      : { section: this.#sectionUuid };
  }

  protected lifecycleLabel(lc: TaskLifecycle): string {
    return LIFECYCLE_LABELS[lc];
  }

  protected emptyTitle(): string {
    return this.isStudent() ? 'No tienes tareas pendientes' : 'Aún no hay tareas';
  }

  protected emptyDescription(): string {
    if (this.isStudent()) {
      return 'Cuando tu docente publique tareas en esta sección aparecerán aquí.';
    }
    return this._lifecycleFilter()
      ? 'No hay tareas con ese estado. Cambia el filtro o crea una nueva.'
      : 'Crea la primera tarea para que los alumnos puedan ver y entregar.';
  }

  protected onLifecycleChange(value: TaskLifecycle | undefined): void {
    this._lifecycleFilter.set(value);
    if (!this.#sectionUuid) return;
    void this.store.loadBySection(this.#sectionUuid, {
      lifecycle: value,
      assignmentPublicUuid: this.#assignmentUuid ?? undefined,
    });
  }

  protected reload(): void {
    if (!this.#sectionUuid) return;
    this.store.clearError();
    void this.store.loadBySection(this.#sectionUuid, {
      lifecycle: this._lifecycleFilter(),
      assignmentPublicUuid: this.#assignmentUuid ?? undefined,
    });
  }

  protected async onPublish(publicUuid: string): Promise<void> {
    await this.store.publishTask(publicUuid);
    if (this.#sectionUuid) {
      void this.store.loadBySection(this.#sectionUuid, {
        lifecycle: this._lifecycleFilter(),
        assignmentPublicUuid: this.#assignmentUuid ?? undefined,
      });
    }
  }

  protected onOpenDetail(publicUuid: string): void {
    void this.router.navigate(['/lms', 'assignments', publicUuid]).catch(() => undefined);
  }

  protected onOpenGrade(publicUuid: string): void {
    void this.router.navigate(['/lms', 'assignments', publicUuid, 'grade']).catch(() => undefined);
  }

  private isStudent(): boolean {
    return this.auth.hasRole(UserRole.Student);
  }
}

const LIFECYCLE_LABELS: Record<TaskLifecycle, string> = {
  [TaskLifecycle.Draft]: 'Borrador',
  [TaskLifecycle.Published]: 'Publicada',
  [TaskLifecycle.Closed]: 'Cerrada',
};
