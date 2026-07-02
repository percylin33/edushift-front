import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ROUTES } from '@core/constants';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import {
  EVALUATION_KIND_LABELS,
  EVALUATION_SCALE_LABELS,
  EvaluationScale,
  EvaluationStatus,
} from '@features/evaluations/models';
import { EvaluationStatusBadgeComponent } from '@features/evaluations/components/evaluation-status-badge.component';
import { GradeBook, GradeBookEvaluation, GradeBookStudent, cellKey } from '../../models';
import { GradeBookStore } from '../../store';

/**
 * `/evaluations/by-assignment/:assignmentUuid/gradebook` — Grade book
 * matrix per teacher assignment (FE-5B.4 / BE-5B.4).
 *
 * <h3>Layout</h3>
 * <ul>
 *   <li>Header sticky superior (top-0): cada columna es una evaluation
 *       con kind label + scheduledDate + weight + status badge.</li>
 *   <li>Columna sticky izquierda (left-0): nombre del estudiante.</li>
 *   <li>Última columna (sticky right-0): promedio ponderado por
 *       estudiante (calculado por el backend, ADR-5B.17 — solo
 *       SCORE_0_20 × PUBLISHED|CLOSED).</li>
 *   <li>Click en una celda → /evaluations/:evalUuid/grades.</li>
 *   <li>Mobile (≤640px): cards collapsibles por estudiante en lugar
 *       de la matriz. ADR-5B.20.</li>
 * </ul>
 *
 * <h3>Cell rendering</h3>
 * <ul>
 *   <li>Vacía → "—" en gris (warning sutil cuando la evaluation está
 *       PUBLISHED y faltan notas).</li>
 *   <li>Score → número con 2 decimales, monoespaciado.</li>
 *   <li>Literal → badge.</li>
 *   <li>Status `CLOSED` con score → primary tint (la nota es final).</li>
 * </ul>
 */
@Component({
  selector: 'app-gradebook-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    EmptyStateComponent,
    EvaluationStatusBadgeComponent,
    IconComponent,
    PageContainerComponent,
    PageHeaderComponent,
    SpinnerComponent,
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header eyebrow="Libro de calificaciones" [title]="title()" [subtitle]="subtitle()">
        <button type="button" class="btn btn-ghost btn-sm" (click)="goBack()">
          <app-icon name="chevron-left" [size]="16" />
          <span>Volver</span>
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          [disabled]="loading()"
          (click)="reload()"
        >
          <app-icon name="bar-chart" [size]="16" />
          <span>Actualizar</span>
        </button>
      </app-page-header>

      @if (gradebook(); as gb) {
        <div class="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <span class="badge badge-neutral">
            <app-icon name="users" [size]="12" class="mr-1" />
            {{ gb.students.length }} estudiantes
          </span>
          <span class="badge badge-neutral">
            <app-icon name="target" [size]="12" class="mr-1" />
            {{ gb.evaluations.length }} evaluaciones
          </span>
          <span
            class="badge"
            [class.badge-success]="totalWeight() === 100"
            [class.badge-warning]="totalWeight() !== 100 && totalWeight() > 0"
            [class.badge-neutral]="totalWeight() === 0"
          >
            Σ peso publicado: {{ totalWeight() | number: '1.0-2' }}
          </span>
        </div>
      }

      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando libro de calificaciones…" />
        </div>
      } @else if (errorBanner()) {
        <div class="alert alert-danger">
          <app-icon name="alert-circle" [size]="18" />
          <p class="flex-1 text-sm">{{ errorBanner() }}</p>
          <button type="button" class="btn btn-ghost btn-sm" (click)="reload()">Reintentar</button>
        </div>
      }

      @if (!loading() && gradebook(); as gb) {
        @if (gb.students.length === 0 && gb.evaluations.length === 0) {
          <app-empty-state
            icon="bar-chart"
            title="Aún no hay nada que mostrar"
            description="Esta asignación no tiene estudiantes inscritos ni evaluaciones registradas. Una vez que agregues una de las dos cosas, el libro se llenará automáticamente."
          />
        } @else if (gb.students.length === 0) {
          <app-empty-state
            icon="users"
            title="Sin estudiantes inscritos"
            description="La sección asociada a esta asignación no tiene matriculados activos en el año académico actual."
          />
        } @else if (gb.evaluations.length === 0) {
          <app-empty-state
            icon="target"
            title="Sin evaluaciones"
            description="Crea evaluaciones desde la pantalla de la asignación para empezar a llenar el libro."
          >
            <button type="button" class="btn btn-primary btn-sm" (click)="goToEvaluations()">
              <app-icon name="plus" [size]="16" />
              <span>Ir a evaluaciones</span>
            </button>
          </app-empty-state>
        } @else {
          <!-- Desktop: matriz -->
          <section class="card hidden overflow-hidden md:block">
            <div class="overflow-x-auto" tabindex="0">
              <table class="gradebook-table">
                <thead>
                  <tr>
                    <th class="sticky-left sticky-top student-col z-30">Estudiante</th>
                    @for (e of gb.evaluations; track e.publicUuid) {
                      <th class="sticky-top eval-col z-20" [title]="evaluationTitle(e)">
                        <button
                          type="button"
                          class="eval-header"
                          (click)="goToEvaluation(e.publicUuid)"
                        >
                          <span class="text-xs uppercase text-content-muted">
                            {{ kindLabel(e.kind) }}
                          </span>
                          <p class="truncate font-medium">{{ e.name }}</p>
                          <div class="mt-1 flex items-center justify-between gap-1">
                            <span class="text-xs text-content-muted">
                              {{ formatDate(e.scheduledDate) }}
                            </span>
                            <span class="font-mono text-xs">
                              p {{ e.weight | number: '1.0-2' }}
                            </span>
                          </div>
                          <app-evaluation-status-badge [status]="e.status" />
                        </button>
                      </th>
                    }
                    <th class="sticky-right sticky-top avg-col z-30">
                      Promedio<br />
                      <span class="text-xs font-normal text-content-muted"> ponderado </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  @for (s of gb.students; track s.publicUuid) {
                    <tr>
                      <th class="sticky-left student-col z-10 text-left">
                        <p class="font-medium">{{ s.fullName }}</p>
                        <p class="font-mono text-xs text-content-muted">
                          {{ shorten(s.publicUuid) }}
                        </p>
                      </th>
                      @for (e of gb.evaluations; track e.publicUuid) {
                        <td
                          class="cell"
                          [class.cell-empty]="!hasCell(s, e)"
                          [class.cell-warning]="!hasCell(s, e) && e.status === statusPublished"
                          [class.cell-final]="hasScore(s, e) && e.status === statusClosed"
                          [title]="cellTitle(s, e)"
                          (click)="goToEvaluation(e.publicUuid)"
                        >
                          @if (cellScore(s, e); as score) {
                            <span class="font-mono tabular-nums">
                              {{ score | number: '1.0-2' }}
                            </span>
                          } @else {
                            @if (cellLiteral(s, e); as literal) {
                              <span class="badge badge-neutral font-mono">
                                {{ literal }}
                              </span>
                            } @else {
                              <span class="text-content-muted">—</span>
                            }
                          }
                        </td>
                      }
                      <td class="sticky-right avg-col z-10">
                        @if (s.weightedAverage !== null) {
                          <span
                            class="font-mono font-semibold tabular-nums"
                            [class.text-success-700]="s.weightedAverage >= 14"
                            [class.text-danger-700]="s.weightedAverage < 11"
                          >
                            {{ s.weightedAverage | number: '1.0-2' }}
                          </span>
                        } @else {
                          <span class="text-content-muted">—</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>

          <!-- Mobile: cards por estudiante (colapsibles) -->
          <section class="grid gap-3 md:hidden">
            @for (s of gb.students; track s.publicUuid) {
              <article class="card">
                <header class="card-header flex items-center justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-medium">{{ s.fullName }}</p>
                    <p class="text-xs text-content-muted">
                      Promedio:
                      @if (s.weightedAverage !== null) {
                        <strong class="tabular-nums">
                          {{ s.weightedAverage | number: '1.0-2' }}
                        </strong>
                      } @else {
                        —
                      }
                    </p>
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    (click)="toggleExpand(s.publicUuid)"
                  >
                    <app-icon
                      [name]="expanded().has(s.publicUuid) ? 'chevron-up' : 'chevron-down'"
                      [size]="16"
                    />
                  </button>
                </header>
                @if (expanded().has(s.publicUuid)) {
                  <div class="card-body grid gap-2">
                    @for (e of gb.evaluations; track e.publicUuid) {
                      <button
                        type="button"
                        class="flex items-center justify-between gap-3 rounded-md px-3 py-2 hover:bg-surface-subtle"
                        (click)="goToEvaluation(e.publicUuid)"
                      >
                        <div class="min-w-0 flex-1 text-left">
                          <p class="text-xs uppercase text-content-muted">
                            {{ kindLabel(e.kind) }}
                          </p>
                          <p class="truncate text-sm font-medium">{{ e.name }}</p>
                        </div>
                        @if (cellScore(s, e); as score) {
                          <span class="font-mono text-sm tabular-nums">
                            {{ score | number: '1.0-2' }}
                          </span>
                        } @else {
                          @if (cellLiteral(s, e); as literal) {
                            <span class="badge badge-neutral font-mono text-xs">
                              {{ literal }}
                            </span>
                          } @else {
                            <span class="text-sm text-content-muted">—</span>
                          }
                        }
                      </button>
                    }
                  </div>
                }
              </article>
            }
          </section>
        }
      }
    </app-page-container>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .gradebook-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        font-size: 0.875rem;
      }
      .gradebook-table th,
      .gradebook-table td {
        border-bottom: 1px solid var(--color-border-subtle, #e5e7eb);
        border-right: 1px solid var(--color-border-subtle, #e5e7eb);
        padding: 0.5rem 0.75rem;
        background: white;
      }
      .gradebook-table thead th {
        background: var(--color-surface-subtle, #f9fafb);
        font-weight: 600;
        font-size: 0.75rem;
      }
      .sticky-left {
        position: sticky;
        left: 0;
      }
      .sticky-right {
        position: sticky;
        right: 0;
      }
      .sticky-top {
        position: sticky;
        top: 0;
      }
      .student-col {
        min-width: 220px;
        max-width: 280px;
        text-align: left;
      }
      .eval-col {
        min-width: 150px;
        max-width: 220px;
      }
      .avg-col {
        min-width: 100px;
        text-align: center;
        background: var(--color-surface-subtle, #f9fafb) !important;
      }
      .eval-header {
        display: block;
        width: 100%;
        text-align: left;
        cursor: pointer;
        background: transparent;
        border: 0;
        padding: 0;
      }
      .eval-header:hover {
        text-decoration: underline;
      }
      .cell {
        text-align: center;
        cursor: pointer;
        transition: background-color 0.15s ease;
      }
      .cell:hover {
        background-color: var(--color-surface-hover, rgba(0, 0, 0, 0.04));
      }
      .cell-empty {
        color: var(--color-content-muted, #6b7280);
      }
      .cell-warning {
        background-color: rgba(251, 191, 36, 0.08);
      }
      .cell-final {
        background-color: rgba(34, 197, 94, 0.08);
        font-weight: 600;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        padding: 0.125rem 0.5rem;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        line-height: 1.25rem;
      }
      .badge-neutral {
        background: var(--color-surface-subtle, #f3f4f6);
        color: var(--color-content, #111827);
      }
      .badge-success {
        background: rgba(34, 197, 94, 0.12);
        color: var(--color-success-700, #15803d);
      }
      .badge-warning {
        background: rgba(251, 191, 36, 0.12);
        color: var(--color-warning-700, #b45309);
      }
    `,
  ],
})
export class GradeBookPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(GradeBookStore);

  protected readonly gradebook = this.store.gradebook;
  protected readonly loading = this.store.loading;
  protected readonly errorBanner = this.store.error;
  protected readonly totalWeight = this.store.totalWeight;

  protected readonly statusPublished = EvaluationStatus.PUBLISHED;
  protected readonly statusClosed = EvaluationStatus.CLOSED;

  protected readonly expanded = signal<Set<string>>(new Set());

  protected readonly title = computed(() => {
    const gb = this.gradebook();
    return gb ? `${gb.courseName} — ${gb.sectionName}` : 'Libro de calificaciones';
  });
  protected readonly subtitle = computed(() => {
    const gb = this.gradebook();
    return gb ? 'Promedio ponderado calculado en vivo' : '';
  });

  private routeSub?: Subscription;
  private currentAssignmentUuid: string | null = null;

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  async ngOnInit(): Promise<void> {
    this.store.clearError();
    this.routeSub = this.route.paramMap.subscribe(async (params) => {
      const uuid = params.get('assignmentUuid');
      if (!uuid) {
        await this.router.navigate([ROUTES.DASHBOARD.ROOT]);
        return;
      }
      this.currentAssignmentUuid = uuid;
      await this.store.load(uuid);
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.store.clear();
  }

  // ===========================================================================
  // Helpers (template)
  // ===========================================================================

  protected hasCell(s: GradeBookStudent, e: GradeBookEvaluation): boolean {
    return this.gradebook()?.cellIndex.has(cellKey(s.publicUuid, e.publicUuid)) ?? false;
  }

  protected hasScore(s: GradeBookStudent, e: GradeBookEvaluation): boolean {
    return this.cellScore(s, e) !== null;
  }

  protected cellScore(s: GradeBookStudent, e: GradeBookEvaluation): number | null {
    return this.gradebook()?.cellIndex.get(cellKey(s.publicUuid, e.publicUuid))?.score ?? null;
  }

  protected cellLiteral(s: GradeBookStudent, e: GradeBookEvaluation): string | null {
    return this.gradebook()?.cellIndex.get(cellKey(s.publicUuid, e.publicUuid))?.literal ?? null;
  }

  protected cellTitle(s: GradeBookStudent, e: GradeBookEvaluation): string {
    const has = this.hasCell(s, e);
    return has ? `${s.fullName} · ${e.name}` : `${s.fullName} · ${e.name} (sin nota)`;
  }

  protected evaluationTitle(e: GradeBookEvaluation): string {
    return [
      e.name,
      EVALUATION_KIND_LABELS[e.kind],
      EVALUATION_SCALE_LABELS[e.scale],
      `peso ${e.weight}`,
      this.formatDate(e.scheduledDate),
    ].join(' · ');
  }

  protected kindLabel(k: GradeBookEvaluation['kind']): string {
    return EVALUATION_KIND_LABELS[k];
  }

  protected scaleLabel(s: EvaluationScale): string {
    return EVALUATION_SCALE_LABELS[s];
  }

  protected formatDate(d: Date): string {
    return d.toLocaleDateString('es', {
      day: '2-digit',
      month: 'short',
    });
  }

  protected shorten(uuid: string): string {
    return uuid.length > 12 ? `${uuid.slice(0, 8)}…` : uuid;
  }

  // ===========================================================================
  // Navigation
  // ===========================================================================

  protected goBack(): void {
    history.back();
  }

  protected goToEvaluation(publicUuid: string): void {
    void this.router.navigate([ROUTES.EVALUATIONS.grades(publicUuid)]);
  }

  protected goToEvaluations(): void {
    if (!this.currentAssignmentUuid) return;
    void this.router.navigate([ROUTES.EVALUATIONS.byAssignment(this.currentAssignmentUuid)]);
  }

  protected async reload(): Promise<void> {
    if (!this.currentAssignmentUuid) return;
    await this.store.load(this.currentAssignmentUuid);
  }

  protected toggleExpand(studentUuid: string): void {
    const set = new Set(this.expanded());
    if (set.has(studentUuid)) set.delete(studentUuid);
    else set.add(studentUuid);
    this.expanded.set(set);
  }
}
