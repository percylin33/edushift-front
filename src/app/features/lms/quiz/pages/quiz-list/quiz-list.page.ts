import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { Permission } from '@core/enums';
import { EmptyStateComponent, IconComponent } from '@shared/components';
import { HasPermissionDirective } from '@shared/directives';
import { QuizzesStore } from '../../store/quizzes.store';
import { ALL_QUIZ_STATUSES, QuizRow, QuizStatus } from '../../models/quiz.model';
import { QuizLifecycleBadgeComponent } from '../../components/quiz-lifecycle-badge/quiz-lifecycle-badge.component';

/**
 * `/lms/sections/:sectionUuid/quizzes` — listing del TEACHER (FE-7b.1).
 *
 * <h3>Responsabilidades</h3>
 * <ul>
 *   <li>Cargar el listing de la sección vía {@link QuizzesStore}.</li>
 *   <li>Filtro por lifecycle (DRAFT / PUBLISHED / CLOSED / Todos).</li>
 *   <li>Cada card expone acciones contextuales vía `*appHasPermission`:
 *       editar (DRAFT), publicar (DRAFT), cerrar (PUBLISHED), eliminar
 *       (DRAFT).</li>
 *   <li>Empty state contextual: "Crear primer quiz" si es TEACHER.</li>
 * </ul>
 *
 * <h3>RBAC</h3>
 * El {@code canMatch: [permissionGuard]} con {@code LMS_QUIZ_READ} ya
 * se aplicó en {@code lms.routes.ts}; aquí la directiva cubre el caso
 * "el botón Crear aparece sólo para TEACHER/ADMIN" (LMS_QUIZ_CREATE)
 * y las acciones de lifecycle (también LMS_QUIZ_CREATE; el backend
 * las enforces por separado).
 */
@Component({
  selector: 'app-quiz-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IconComponent,
    EmptyStateComponent,
    HasPermissionDirective,
    QuizLifecycleBadgeComponent,
  ],
  template: `
    <header class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <h1 class="text-2xl font-semibold text-content">Quizzes de la sección</h1>
        <p class="text-sm text-content-muted">
          Gestiona los quizzes que ven los alumnos enrolados.
        </p>
      </div>

      <a
        *appHasPermission="permission.LmsQuizCreate"
        [routerLink]="newQuizRoute()"
        class="btn btn-primary btn-sm self-start sm:self-auto"
      >
        <app-icon name="plus" [size]="16" />
        <span class="hidden sm:inline">Nuevo quiz</span>
      </a>
    </header>

    <!-- Filtros -->
    <section class="card mb-4">
      <div class="card-body grid gap-3 sm:grid-cols-12">
        <div class="sm:col-span-4">
          <label class="label" for="quizzes-status">Estado</label>
          <select
            id="quizzes-status"
            class="select"
            [ngModel]="statusFilter()"
            (ngModelChange)="onStatusChange($event)"
          >
            <option [ngValue]="undefined">Todos</option>
            @for (st of statuses; track st) {
              <option [ngValue]="st">{{ statusLabel(st) }}</option>
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
          <p class="font-medium">No pudimos cargar los quizzes.</p>
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
        [icon]="'list-checks'"
      >
        <a
          *appHasPermission="permission.LmsQuizCreate"
          [routerLink]="newQuizRoute()"
          class="btn btn-primary btn-sm"
        >
          <app-icon name="plus" [size]="16" />
          Crear primer quiz
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
                  <a
                    [routerLink]="detailRoute(row.publicUuid)"
                    class="hover:underline focus:outline-none"
                  >
                    {{ row.title }}
                  </a>
                </h2>
                <app-quiz-lifecycle-badge [status]="row.status" />
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
                  <dt class="font-medium text-content">Preguntas</dt>
                  <dd>{{ row.questionCount }} ({{ row.totalPoints }} pts)</dd>
                </div>
                <div>
                  <dt class="font-medium text-content">Intentos</dt>
                  <dd>{{ row.maxAttempts }}</dd>
                </div>
                @if (row.timeLimitMinutes) {
                  <div class="col-span-2">
                    <dt class="font-medium text-content">Tiempo límite</dt>
                    <dd>{{ row.timeLimitMinutes }} min</dd>
                  </div>
                }
              </dl>

              <footer class="flex flex-wrap items-center gap-2 pt-1">
                <a [routerLink]="detailRoute(row.publicUuid)" class="btn btn-ghost btn-sm">
                  Ver detalle
                </a>
                <ng-container *appHasPermission="permission.LmsQuizCreate">
                  @if (row.status === 'DRAFT') {
                    <a [routerLink]="editRoute(row.publicUuid)" class="btn btn-ghost btn-sm">
                      Editar
                    </a>
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm"
                      [disabled]="saving() || row.questionCount === 0"
                      (click)="onPublish(row)"
                    >
                      Publicar
                    </button>
                  }
                  @if (row.status === 'PUBLISHED') {
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm"
                      [disabled]="saving()"
                      (click)="onClose(row)"
                    >
                      Cerrar
                    </button>
                  }
                </ng-container>
              </footer>
            </div>
          </article>
        }
      </div>
    }
  `,
})
export class QuizListPageComponent implements OnInit {
  private readonly store = inject(QuizzesStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly rows = this.store.rows;
  protected readonly loading = this.store.loading;
  protected readonly errorBanner = this.store.error;
  protected readonly saving = this.store.saving;
  protected readonly permission = Permission;
  protected readonly statuses = ALL_QUIZ_STATUSES;

  /** Locally-tracked value for the `[(ngModel)]` two-way binding. */
  private readonly _statusFilter = signal<QuizStatus | undefined>(undefined);
  protected readonly statusFilter = this._statusFilter.asReadonly();

  ngOnInit(): void {
    const sectionUuid = this.route.snapshot.paramMap.get('sectionUuid');
    if (!sectionUuid) {
      void this.router.navigate([ROUTES.DASHBOARD.ROOT]);
      return;
    }
    this.#sectionUuid = sectionUuid;
    void this.store.loadBySection(sectionUuid);
  }

  #sectionUuid: string | null = null;

  protected newQuizRoute(): string {
    if (!this.#sectionUuid) return ROUTES.LMS.ROOT;
    return ROUTES.LMS.quizNew(this.#sectionUuid);
  }

  protected detailRoute(uuid: string): string {
    return ROUTES.LMS.quizDetail(uuid);
  }

  protected editRoute(uuid: string): string {
    return ROUTES.LMS.quizEdit(uuid);
  }

  protected statusLabel(st: QuizStatus): string {
    return STATUS_LABELS[st];
  }

  protected emptyTitle(): string {
    return 'Aún no hay quizzes';
  }

  protected emptyDescription(): string {
    return this._statusFilter()
      ? 'No hay quizzes con ese estado. Cambia el filtro o crea uno nuevo.'
      : 'Crea el primer quiz para que los alumnos puedan tomarlo.';
  }

  protected onStatusChange(value: QuizStatus | undefined): void {
    this._statusFilter.set(value);
    this.store.setStatusFilter(value);
  }

  protected reload(): void {
    if (!this.#sectionUuid) return;
    this.store.clearError();
    void this.store.loadBySection(this.#sectionUuid, {
      status: this._statusFilter(),
    });
  }

  protected async onPublish(row: QuizRow): Promise<void> {
    if (row.questionCount === 0) return;
    await this.store.publishQuiz(row.publicUuid);
  }

  protected async onClose(row: QuizRow): Promise<void> {
    await this.store.closeQuiz(row.publicUuid);
  }
}

const STATUS_LABELS: Record<QuizStatus, string> = {
  [QuizStatus.Draft]: 'Borrador',
  [QuizStatus.Published]: 'Publicado',
  [QuizStatus.Closed]: 'Cerrado',
};
