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
import { firstValueFrom, Subscription } from 'rxjs';
import { ROUTES } from '@core/constants';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import {
  EvaluationFormModalComponent,
  EvaluationKindBadgeComponent,
  EvaluationStatusBadgeComponent,
} from '../../components';
import { EvaluationsStore } from '../../store';
import {
  EVALUATION_STATUS_LABELS,
  EvaluationDetail,
  EvaluationFilters,
  EvaluationRow,
  EvaluationStatus,
  isEvaluationDeletable,
  isEvaluationEditable,
  legalNextStatuses,
} from '../../models';
import { EvaluationsApiService } from '../../services';

/**
 * `/evaluations/by-assignment/:assignmentUuid` — Listado de evaluations
 * para una `TeacherAssignment` (FE-5B.1).
 *
 * <h3>Funcionalidad</h3>
 * <ul>
 *   <li>Filtros URL-synced: {@code status}, {@code from}, {@code to},
 *       {@code isActive}.</li>
 *   <li>Tabla con: tipo, nombre, peso, fecha, escala, status, % calificado,
 *       acciones.</li>
 *   <li>Acciones de lifecycle (DRAFT → PUBLISHED → CLOSED) y soft-delete
 *       (solo DRAFT y sin grades).</li>
 *   <li>Modal de creación/edición con validación cliente que espeja la
 *       matriz `kind × scale` y la editability matrix server-side.</li>
 *   <li>Indicador "X/Y calificados" cuando se conoce el roster (deferido
 *       a sprint posterior — por ahora solo gradeCount absoluto).</li>
 * </ul>
 *
 * <p>El listado se carga por {@link #assignmentUuid} extraído del path.
 * Si el route no trae UUID válido, se redirige al dashboard.</p>
 */
@Component({
  selector: 'app-evaluations-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    EmptyStateComponent,
    EvaluationFormModalComponent,
    EvaluationKindBadgeComponent,
    EvaluationStatusBadgeComponent,
    IconComponent,
    PageContainerComponent,
    PageHeaderComponent,
    SpinnerComponent,
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header eyebrow="Evaluaciones" [title]="headerTitle()" [subtitle]="headerSubtitle()">
        <button type="button" class="btn btn-ghost btn-sm" (click)="goBack()">
          <app-icon name="chevron-left" [size]="16" />
          <span>Volver</span>
        </button>
        <button type="button" class="btn btn-ghost btn-sm" (click)="goToGradeBook()">
          <app-icon name="bar-chart" [size]="16" />
          <span>Libro de calificaciones</span>
        </button>
        <button type="button" class="btn btn-primary btn-sm" (click)="openCreate()">
          <app-icon name="plus" [size]="16" />
          <span>Nueva evaluación</span>
        </button>
      </app-page-header>

      <!-- Filtros -->
      <section class="card mb-4">
        <div class="card-body grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="field">
            <label class="label">Estado</label>
            <select
              class="input"
              [value]="filters().status ?? ''"
              (change)="onFilterChange('status', $any($event.target).value || undefined)"
            >
              <option value="">Todos</option>
              @for (s of statuses; track s) {
                <option [value]="s">{{ statusLabel(s) }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label class="label">Desde</label>
            <input
              type="date"
              class="input"
              [value]="filters().from ?? ''"
              (change)="onFilterChange('from', $any($event.target).value || undefined)"
            />
          </div>

          <div class="field">
            <label class="label">Hasta</label>
            <input
              type="date"
              class="input"
              [value]="filters().to ?? ''"
              (change)="onFilterChange('to', $any($event.target).value || undefined)"
            />
          </div>

          <div class="flex items-end gap-2">
            <label class="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                class="form-checkbox"
                [checked]="filters().isActive !== false"
                (change)="
                  onFilterChange('isActive', $any($event.target).checked ? undefined : false)
                "
              />
              <span>Solo activas</span>
            </label>
            <button type="button" class="btn btn-ghost btn-sm ml-auto" (click)="clearFilters()">
              <app-icon name="x" [size]="14" />
              <span>Limpiar</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Weight summary -->
      @if (rows().length > 0) {
        <div
          class="mb-4 flex items-center gap-3 rounded-md border px-4 py-2 text-sm"
          [class.border-warning-300]="weightTotal() !== 100 && weightTotal() > 0"
          [class.bg-warning-50]="weightTotal() !== 100 && weightTotal() > 0"
          [class.border-border-subtle]="weightTotal() === 100 || weightTotal() === 0"
          [class.bg-surface-subtle]="weightTotal() === 100 || weightTotal() === 0"
        >
          <app-icon [name]="weightTotal() === 100 ? 'check' : 'alert-circle'" [size]="16" />
          <span class="text-content-muted">
            Peso total de evaluaciones publicadas / cerradas:
          </span>
          <span class="font-semibold text-content">
            {{ weightTotal() | number: '1.0-2' }}
          </span>
          @if (weightTotal() !== 100 && weightTotal() > 0) {
            <span class="text-warning-700 text-xs"> (lo ideal es 100) </span>
          }
        </div>
      }

      <!-- Tabla -->
      <section class="card overflow-hidden">
        @if (loading()) {
          <div class="flex items-center justify-center py-16">
            <app-spinner [size]="24" label="Cargando evaluaciones…" />
          </div>
        } @else if (errorBanner()) {
          <div class="alert alert-danger m-5">
            <app-icon name="alert-circle" [size]="18" />
            <div class="flex-1">
              <p class="font-medium">No pudimos cargar las evaluaciones.</p>
              <p class="mt-1 text-xs opacity-80">{{ errorBanner() }}</p>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" (click)="reload()">
              Reintentar
            </button>
          </div>
        } @else if (rows().length === 0) {
          <app-empty-state
            icon="target"
            title="Aún no hay evaluaciones"
            description="Crea la primera evaluación para esta asignación. Empezará en estado borrador y podrás publicarla cuando esté lista."
          >
            <button type="button" class="btn btn-primary btn-sm" (click)="openCreate()">
              <app-icon name="plus" [size]="16" />
              <span>Crear evaluación</span>
            </button>
          </app-empty-state>
        } @else {
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Nombre</th>
                  <th class="text-right">Peso</th>
                  <th>Fecha</th>
                  <th>Calificadas</th>
                  <th>Estado</th>
                  <th class="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.publicUuid) {
                  <tr class="hover:bg-surface-subtle">
                    <td>
                      <app-evaluation-kind-badge [kind]="row.kind" />
                    </td>
                    <td>
                      <p class="font-medium text-content">{{ row.name }}</p>
                      @if (!row.isActive) {
                        <p class="text-xs text-content-muted">Inactiva</p>
                      }
                    </td>
                    <td class="text-right tabular-nums">
                      {{ row.weight | number: '1.0-2' }}
                    </td>
                    <td>
                      <p class="text-sm">{{ formatDate(row.scheduledDate) }}</p>
                      @if (row.dueDate) {
                        <p class="text-xs text-content-muted">
                          entrega {{ formatDate(row.dueDate) }}
                        </p>
                      }
                    </td>
                    <td>
                      <span class="font-mono text-sm">{{ row.gradeCount }}</span>
                    </td>
                    <td>
                      <app-evaluation-status-badge [status]="row.status" />
                    </td>
                    <td class="text-right">
                      <div class="flex justify-end gap-1">
                        @for (next of legalNext(row.status); track next) {
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs"
                            [title]="lifecycleHint(row.status, next)"
                            [disabled]="busyRow().has(row.publicUuid)"
                            (click)="onLifecycleHop(row, next)"
                          >
                            @if (next === 'PUBLISHED') {
                              <app-icon name="check" [size]="14" />
                              <span>Publicar</span>
                            } @else if (next === 'CLOSED') {
                              <app-icon name="lock" [size]="14" />
                              <span>Cerrar</span>
                            }
                          </button>
                        }
                        @if (canEdit(row)) {
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs"
                            title="Editar"
                            [disabled]="busyRow().has(row.publicUuid)"
                            (click)="openEdit(row)"
                          >
                            <app-icon name="pencil" [size]="14" />
                          </button>
                        }
                        <button
                          type="button"
                          class="btn btn-ghost btn-xs"
                          title="Ver detalle"
                          (click)="goToDetail(row.publicUuid)"
                        >
                          <app-icon name="eye" [size]="14" />
                        </button>
                        @if (canDelete(row)) {
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs text-danger-600 hover:bg-danger-50"
                            title="Eliminar"
                            [disabled]="busyRow().has(row.publicUuid)"
                            (click)="onDelete(row)"
                          >
                            <app-icon name="x" [size]="14" />
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </app-page-container>

    @if (showCreate()) {
      <app-evaluation-form-modal
        [assignmentUuid]="assignmentUuid()"
        (closed)="closeCreate()"
        (saved)="onCreated($event)"
      />
    }

    @if (editing(); as e) {
      <app-evaluation-form-modal
        [evaluation]="e"
        (closed)="closeEdit()"
        (saved)="onEdited($event)"
      />
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .table {
        @apply w-full text-left text-sm;
      }
      .table th {
        @apply border-b border-border-subtle bg-surface-subtle px-4 py-3 text-xs font-semibold uppercase tracking-wider text-content-muted;
      }
      .table td {
        @apply border-b border-border-subtle px-4 py-3;
      }
    `,
  ],
})
export class EvaluationsListComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(EvaluationsStore);
  private readonly api = inject(EvaluationsApiService);

  protected readonly assignmentUuid = signal<string>('');
  protected readonly assignmentLabel = signal<string>('');

  protected readonly rows = this.store.rows;
  protected readonly loading = this.store.loading;
  protected readonly errorBanner = this.store.error;
  protected readonly filters = this.store.filters;
  protected readonly weightTotal = this.store.weightTotalLive;

  protected readonly showCreate = signal<boolean>(false);
  protected readonly editing = signal<EvaluationDetail | null>(null);
  protected readonly busyRow = signal<Set<string>>(new Set());

  protected readonly statuses: EvaluationStatus[] = [
    EvaluationStatus.DRAFT,
    EvaluationStatus.PUBLISHED,
    EvaluationStatus.CLOSED,
  ];

  protected readonly headerTitle = computed(() => {
    const label = this.assignmentLabel();
    return label || 'Evaluaciones';
  });

  protected readonly headerSubtitle = computed(() => {
    const total = this.rows().length;
    if (total === 0) return 'Aún no se han creado evaluaciones para esta asignación.';
    if (total === 1) return '1 evaluación registrada.';
    return `${total} evaluaciones registradas.`;
  });

  private routeSub?: Subscription;

  async ngOnInit(): Promise<void> {
    this.routeSub = this.route.paramMap.subscribe(async (params) => {
      const uuid = params.get('assignmentUuid');
      if (!uuid) {
        await this.router.navigate([ROUTES.DASHBOARD.ROOT]);
        return;
      }
      this.assignmentUuid.set(uuid);
      await this.loadFromUrl();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  // ===========================================================================
  // Filters (URL-synced)
  // ===========================================================================

  protected async onFilterChange<K extends keyof EvaluationFilters>(
    key: K,
    value: EvaluationFilters[K] | undefined,
  ): Promise<void> {
    const next: EvaluationFilters = { ...this.filters(), [key]: value };
    this.syncUrl(next);
    await this.store.setFilters(next);
  }

  protected async clearFilters(): Promise<void> {
    this.syncUrl({});
    await this.store.clearFilters();
  }

  protected statusLabel(s: EvaluationStatus): string {
    return EVALUATION_STATUS_LABELS[s];
  }

  // ===========================================================================
  // Reload / navigation
  // ===========================================================================

  protected async reload(): Promise<void> {
    this.store.clearError();
    await this.loadFromUrl();
  }

  protected goBack(): void {
    history.back();
  }

  protected goToDetail(publicUuid: string): void {
    void this.router.navigate([ROUTES.EVALUATIONS.detail(publicUuid)]);
  }

  protected goToGradeBook(): void {
    const uuid = this.assignmentUuid();
    if (!uuid) return;
    void this.router.navigate([ROUTES.EVALUATIONS.gradeBook(uuid)]);
  }

  // ===========================================================================
  // Modals
  // ===========================================================================

  protected openCreate(): void {
    this.store.clearError();
    this.editing.set(null);
    this.showCreate.set(true);
  }

  protected closeCreate(): void {
    this.showCreate.set(false);
  }

  protected onCreated(_detail: EvaluationDetail): void {
    this.showCreate.set(false);
  }

  protected async openEdit(row: EvaluationRow): Promise<void> {
    this.store.clearError();
    this.setBusy(row.publicUuid, true);
    try {
      const detail = await firstValueFrom(this.api.getEvaluation(row.publicUuid));
      this.editing.set(detail);
    } finally {
      this.setBusy(row.publicUuid, false);
    }
  }

  protected closeEdit(): void {
    this.editing.set(null);
  }

  protected onEdited(_detail: EvaluationDetail): void {
    this.editing.set(null);
  }

  // ===========================================================================
  // Lifecycle hops + delete
  // ===========================================================================

  protected legalNext(status: EvaluationStatus): EvaluationStatus[] {
    return legalNextStatuses(status);
  }

  protected lifecycleHint(from: EvaluationStatus, to: EvaluationStatus): string {
    const fromLabel = EVALUATION_STATUS_LABELS[from];
    const toLabel = EVALUATION_STATUS_LABELS[to];
    return `${fromLabel} → ${toLabel}`;
  }

  protected canEdit(row: EvaluationRow): boolean {
    return isEvaluationEditable(row.status);
  }

  protected canDelete(row: EvaluationRow): boolean {
    return isEvaluationDeletable(row.status) && row.gradeCount === 0;
  }

  protected async onLifecycleHop(row: EvaluationRow, target: EvaluationStatus): Promise<void> {
    const fromLabel = EVALUATION_STATUS_LABELS[row.status];
    const toLabel = EVALUATION_STATUS_LABELS[target];
    const ok = confirm(
      `¿Cambiar la evaluación "${row.name}" de ${fromLabel} a ${toLabel}?\n\n` +
        (target === EvaluationStatus.CLOSED
          ? 'Una vez cerrada NO se podrá reabrir.'
          : 'Las evaluaciones publicadas son visibles para los estudiantes.'),
    );
    if (!ok) return;

    this.setBusy(row.publicUuid, true);
    try {
      if (target === EvaluationStatus.PUBLISHED) {
        await this.store.publish(row.publicUuid);
      } else if (target === EvaluationStatus.CLOSED) {
        await this.store.close(row.publicUuid);
      }
    } finally {
      this.setBusy(row.publicUuid, false);
    }
  }

  protected async onDelete(row: EvaluationRow): Promise<void> {
    const ok = confirm(
      `¿Eliminar la evaluación borrador "${row.name}"?\n\n` +
        'Solo se permite eliminar borradores sin calificaciones registradas.',
    );
    if (!ok) return;

    this.setBusy(row.publicUuid, true);
    try {
      await this.store.remove(row.publicUuid);
    } finally {
      this.setBusy(row.publicUuid, false);
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  protected formatDate(d: Date): string {
    return d.toLocaleDateString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async loadFromUrl(): Promise<void> {
    const uuid = this.assignmentUuid();
    if (!uuid) return;
    const filters = this.parseFiltersFromUrl();
    await this.store.loadByAssignment(uuid, filters);
    this.refreshAssignmentLabel();
  }

  private parseFiltersFromUrl(): EvaluationFilters {
    const qp = this.route.snapshot.queryParamMap;
    const status = qp.get('status') as EvaluationStatus | null;
    const isActiveStr = qp.get('isActive');
    return {
      status: status ?? undefined,
      from: qp.get('from') ?? undefined,
      to: qp.get('to') ?? undefined,
      isActive: isActiveStr === null ? undefined : isActiveStr === 'true',
    };
  }

  private syncUrl(filters: EvaluationFilters): void {
    const cleanParams: Record<string, string> = {};
    if (filters.status) cleanParams['status'] = filters.status;
    if (filters.from) cleanParams['from'] = filters.from;
    if (filters.to) cleanParams['to'] = filters.to;
    if (filters.isActive === false) cleanParams['isActive'] = 'false';

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: cleanParams,
      queryParamsHandling: '',
      replaceUrl: true,
    });
  }

  private refreshAssignmentLabel(): void {
    const first = this.rows()[0];
    // El listing no tiene `assignment.label` en EvaluationListItem; lo
    // tomaremos del primer detail load del modal o lo dejaremos vacío
    // hasta navegar al detail. Simple por ahora: mantener vacío.
    if (!first) {
      this.assignmentLabel.set('');
    }
  }

  private setBusy(publicUuid: string, busy: boolean): void {
    const set = new Set(this.busyRow());
    if (busy) set.add(publicUuid);
    else set.delete(publicUuid);
    this.busyRow.set(set);
  }
}
