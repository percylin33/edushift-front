import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EmptyStateComponent, IconComponent, SpinnerComponent } from '@shared/components';
import {
  AcademicYearStatusBadgeComponent,
  PeriodFormModalComponent,
  PeriodTimelineComponent,
} from '../../components';
import { TimelinePreviewItem } from '../../components/period-timeline.component';
import { AcademicStore } from '../../store';
import {
  AcademicPeriodDetail,
  AcademicPeriodRow,
  AcademicYearRow,
  AcademicYearStatus,
  PERIOD_TYPE_LABELS,
  PeriodType,
  planBulkPeriods,
  toLocalDateString,
} from '../../models';

/**
 * `/academic/periods` — gestión de periodos académicos (BE-4.5).
 *
 * <h3>Layout</h3>
 * <ol>
 *   <li><b>Toolbar</b>: selector de año (default = ACTIVE), filtro de
 *       type, botón "Generar bimestres/trimestres" y "Nuevo periodo".</li>
 *   <li><b>Timeline</b>: vista horizontal del año con bloques
 *       coloreados por type; click en un bloque abre el modal de
 *       edición.</li>
 *   <li><b>Tabla auxiliar</b>: ordinal, type, name, fechas, acciones.</li>
 * </ol>
 *
 * <h3>Bulk-generator</h3>
 * El botón abre un confirm con preview del plan calculado por
 * {@code planBulkPeriods}. Al confirmar dispara N {@code POST}s
 * secuenciales via {@code store.createPeriodsBulk}; el progreso se
 * publica en {@code store.bulkProgress} y se renderiza como banner.
 * Si el year ya tiene periodos del mismo type avisa al admin (no
 * reemplaza, suma — el BE rechazaría con {@code PERIOD_ORDINAL_TAKEN}
 * o {@code PERIOD_DATE_OVERLAP}).
 *
 * <h3>URL sync</h3>
 * Filtros persisten en {@code ?yearId} y {@code ?periodType} para que
 * un refresh (F5) preserve la elección.
 */
@Component({
  selector: 'app-periods-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    EmptyStateComponent,
    IconComponent,
    SpinnerComponent,
    AcademicYearStatusBadgeComponent,
    PeriodTimelineComponent,
    PeriodFormModalComponent,
  ],
  template: `
    <header class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <h2 class="text-lg font-semibold text-content">Periodos</h2>
        <p class="text-sm text-content-muted">
          Bimestres, trimestres o periodo anual del año académico. Los rangos no pueden solapar
          entre periodos del mismo tipo.
        </p>
      </div>
      <div class="flex flex-wrap gap-2 self-start sm:self-auto">
        <button
          type="button"
          class="btn btn-outline btn-sm"
          [disabled]="!canBulkGenerate()"
          (click)="openBulkPreview()"
          [title]="bulkButtonTooltip()"
        >
          <app-icon name="sparkles" [size]="16" />
          <span class="hidden sm:inline">
            Generar {{ periodTypeLabel(bulkType()) | lowercase }}s
          </span>
        </button>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          [disabled]="!canCreate()"
          (click)="openCreate()"
          [title]="canCreate() ? '' : 'El año seleccionado está cerrado'"
        >
          <app-icon name="plus" [size]="16" />
          <span class="hidden sm:inline">Nuevo periodo</span>
        </button>
      </div>
    </header>

    <!-- Bulk progress banner -->
    @if (bulkProgress(); as bp) {
      <section class="alert alert-info mb-4">
        <app-spinner [size]="16" label="Generando" />
        <p class="flex-1 text-sm">
          Generando periodos…
          <span class="font-medium">{{ bp.current }} / {{ bp.total }}</span>
        </p>
      </section>
    }

    <!-- Toolbar -->
    <section class="card mb-4">
      <div class="card-body grid gap-3 sm:grid-cols-12">
        <div class="sm:col-span-5">
          <label class="label" for="filter-year">Año académico</label>
          <select
            id="filter-year"
            class="select"
            [ngModel]="yearFilter()"
            (ngModelChange)="onYearChange($event)"
          >
            <option [ngValue]="null">— Año activo —</option>
            @for (y of years(); track y.publicUuid) {
              <option [ngValue]="y.publicUuid">{{ y.name }} · {{ statusLabel(y.status) }}</option>
            }
          </select>
        </div>
        <div class="sm:col-span-4">
          <label class="label" for="filter-type">Tipo</label>
          <select
            id="filter-type"
            class="select"
            [ngModel]="typeFilter()"
            (ngModelChange)="onTypeChange($event)"
          >
            <option [ngValue]="null">Todos</option>
            @for (t of typeOptions; track t.value) {
              <option [ngValue]="t.value">{{ t.label }}</option>
            }
          </select>
        </div>
        <div class="sm:col-span-3">
          <label class="label" for="filter-bulk-type">Tipo a generar</label>
          <select
            id="filter-bulk-type"
            class="select"
            [ngModel]="bulkType()"
            (ngModelChange)="bulkType.set($event)"
          >
            @for (t of typeOptions; track t.value) {
              <option [ngValue]="t.value">{{ t.label }}</option>
            }
          </select>
        </div>
      </div>
    </section>

    <!-- Timeline -->
    @if (resolvedYear(); as ry) {
      <section class="card mb-4">
        <div class="card-body">
          <div class="mb-3 flex items-center justify-between">
            <p class="text-sm font-medium text-content">
              {{ ry.name }}
              <span class="ml-2">
                <app-academic-year-status-badge [status]="ry.status" />
              </span>
            </p>
            <p class="text-xs text-content-muted">
              {{ formatDate(ry.startDate) }} — {{ formatDate(ry.endDate) }}
            </p>
          </div>
          <app-period-timeline
            [yearStart]="ry.startDate"
            [yearEnd]="ry.endDate"
            [periods]="filteredPeriods()"
            (blockClicked)="onTimelineBlockClicked($event)"
          />
        </div>
      </section>
    }

    <!-- Tabla auxiliar -->
    <section class="card overflow-hidden">
      @if (loading() && !hasPeriods()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando periodos…" />
        </div>
      } @else if (errorMessage()) {
        <div class="alert alert-danger m-5">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">No pudimos cargar los periodos.</p>
            <p class="mt-1 text-xs opacity-80">{{ errorMessage() }}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" (click)="retry()">Reintentar</button>
        </div>
      } @else if (filteredPeriods().length === 0) {
        <app-empty-state
          icon="clock"
          title="No hay periodos para los filtros seleccionados"
          description="Crea uno manualmente o genera bimestres/trimestres automáticamente desde el rango del año."
        >
          @if (canCreate()) {
            <button type="button" class="btn btn-primary btn-sm" (click)="openCreate()">
              Nuevo periodo
            </button>
          }
        </app-empty-state>
      } @else {
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th class="w-16">#</th>
                <th>Tipo</th>
                <th class="min-w-[180px]">Nombre</th>
                <th class="hidden sm:table-cell">Inicio</th>
                <th class="hidden sm:table-cell">Fin</th>
                <th class="text-right" aria-label="Acciones"></th>
              </tr>
            </thead>
            <tbody>
              @for (row of filteredPeriods(); track row.publicUuid) {
                <tr>
                  <td class="font-mono text-sm">{{ row.ordinal }}</td>
                  <td>
                    <span class="badge badge-neutral">
                      {{ periodTypeLabel(row.periodType) }}
                    </span>
                  </td>
                  <td>
                    <p class="font-medium text-content">{{ row.name }}</p>
                    <p class="text-xs text-content-muted sm:hidden">
                      {{ formatDate(row.startDate) }} → {{ formatDate(row.endDate) }}
                    </p>
                  </td>
                  <td class="hidden text-content-muted sm:table-cell">
                    {{ formatDate(row.startDate) }}
                  </td>
                  <td class="hidden text-content-muted sm:table-cell">
                    {{ formatDate(row.endDate) }}
                  </td>
                  <td class="text-right">
                    <div class="inline-flex items-center gap-1">
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm"
                        [disabled]="saving() || !canMutate()"
                        (click)="openEdit(row)"
                        [attr.aria-label]="'Editar ' + row.name"
                      >
                        <app-icon name="edit-2" [size]="16" />
                        <span class="hidden sm:inline">Editar</span>
                      </button>
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm text-danger-600 hover:bg-danger-50"
                        [disabled]="saving() || !canDeleteRow(row)"
                        (click)="confirmDelete(row)"
                        [attr.aria-label]="'Eliminar ' + row.name"
                        [title]="
                          canDeleteRow(row)
                            ? ''
                            : 'Solo se puede borrar el último ordinal del par (year, tipo)'
                        "
                      >
                        <app-icon name="trash-2" [size]="16" />
                        <span class="hidden sm:inline">Eliminar</span>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    @if (showModal()) {
      <app-period-form-modal
        [period]="editingPeriod()"
        [defaultYearUuid]="yearFilter() ?? resolvedYear()?.publicUuid ?? null"
        [defaultPeriodType]="typeFilter() ?? bulkType()"
        (closed)="closeModal()"
        (saved)="onSaved()"
      />
    }
  `,
})
export class PeriodsListComponent implements OnInit {
  private readonly store = inject(AcademicStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly years = this.store.years;
  protected readonly currentActive = this.store.currentActive;
  protected readonly periods = this.store.periods;
  protected readonly loading = this.store.loadingPeriods;
  protected readonly saving = this.store.savingPeriod;
  protected readonly hasPeriods = this.store.hasPeriods;
  protected readonly errorMessage = this.store.error;
  protected readonly bulkProgress = this.store.bulkProgress;

  protected readonly yearFilter = signal<string | null>(null);
  protected readonly typeFilter = signal<PeriodType | null>(null);
  /** Tipo a generar con el botón "Generar …". Default = Bimestre. */
  protected readonly bulkType = signal<PeriodType>(PeriodType.Bimestre);

  protected readonly showModal = signal(false);
  protected readonly editingPeriod = signal<AcademicPeriodDetail | null>(null);

  protected readonly typeOptions: ReadonlyArray<{
    value: PeriodType;
    label: string;
  }> = (Object.keys(PERIOD_TYPE_LABELS) as PeriodType[]).map((v) => ({
    value: v,
    label: PERIOD_TYPE_LABELS[v],
  }));

  // ---------------------------------------------------------------------------
  // Computed selecciones
  // ---------------------------------------------------------------------------

  protected readonly resolvedYear = computed<AcademicYearRow | null>(() => {
    const id = this.yearFilter();
    if (id) return this.years().find((y) => y.publicUuid === id) ?? null;
    return this.currentActive() ?? null;
  });

  protected readonly canCreate = computed<boolean>(() => {
    const y = this.resolvedYear();
    return !!y && y.status !== AcademicYearStatus.Closed;
  });

  protected readonly canMutate = computed<boolean>(() => this.canCreate());

  protected readonly canBulkGenerate = computed<boolean>(() => this.canCreate());

  protected readonly bulkButtonTooltip = computed<string>(() => {
    const y = this.resolvedYear();
    if (!y) return 'Selecciona un año académico primero';
    if (y.status === AcademicYearStatus.Closed) return 'El año está cerrado';
    return '';
  });

  protected readonly filteredPeriods = computed<AcademicPeriodRow[]>(() => {
    const yearId = this.resolvedYear()?.publicUuid;
    if (!yearId) return [];
    const t = this.typeFilter();
    return this.periods()
      .filter((p) => p.academicYearPublicUuid === yearId)
      .filter((p) => !t || p.periodType === t);
  });

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  async ngOnInit(): Promise<void> {
    if (this.years().length === 0) await this.store.loadYears();

    const qp = this.route.snapshot.queryParamMap;
    this.yearFilter.set(qp.get('yearId'));
    const t = qp.get('periodType');
    this.typeFilter.set(this.parsePeriodType(t));

    /* Saneamiento. */
    const yearId = this.yearFilter();
    if (yearId && !this.years().some((y) => y.publicUuid === yearId)) {
      this.yearFilter.set(null);
    }

    await this.applyServerFilters();
  }

  // ===========================================================================
  // Toolbar handlers
  // ===========================================================================

  protected onYearChange(value: string | null): void {
    this.yearFilter.set(value);
    void this.syncAndReload();
  }

  protected onTypeChange(value: PeriodType | null): void {
    this.typeFilter.set(value);
    void this.syncAndReload();
  }

  protected retry(): void {
    this.store.clearError();
    void this.applyServerFilters();
  }

  // ===========================================================================
  // Acciones
  // ===========================================================================

  protected openCreate(): void {
    this.editingPeriod.set(null);
    this.showModal.set(true);
  }

  protected openEdit(row: AcademicPeriodRow): void {
    const detail = this.fetchDetail(row.publicUuid);
    if (!detail) return;
    this.editingPeriod.set(detail);
    this.showModal.set(true);
  }

  protected onTimelineBlockClicked(row: AcademicPeriodRow): void {
    this.openEdit(row);
  }

  protected closeModal(): void {
    this.showModal.set(false);
    this.editingPeriod.set(null);
  }

  protected async onSaved(): Promise<void> {
    this.closeModal();
    await this.store.loadPeriods();
  }

  /**
   * Solo el último ordinal del par {@code (year, type)} puede borrarse
   * (el BE responde {@code PERIOD_NOT_LAST_ORDINAL} en otro caso).
   * Lo deshabilitamos client-side para no inducir al admin a hacer
   * la llamada y comerse el 409.
   */
  protected canDeleteRow(row: AcademicPeriodRow): boolean {
    if (!this.canMutate()) return false;
    const sameTuple = this.periods().filter(
      (p) =>
        p.academicYearPublicUuid === row.academicYearPublicUuid && p.periodType === row.periodType,
    );
    if (sameTuple.length === 0) return true;
    const max = sameTuple.reduce((acc, p) => Math.max(acc, p.ordinal), 0);
    return row.ordinal === max;
  }

  protected async confirmDelete(row: AcademicPeriodRow): Promise<void> {
    const ok = confirm(
      `¿Eliminar el periodo "${row.name}"?\n\n` +
        'Solo se puede borrar el último ordinal del par (año, tipo). Si\n' +
        'querés renumerar, borrá de mayor a menor y recreá los que falten.',
    );
    if (!ok) return;
    await this.store.deletePeriod(row.publicUuid);
  }

  // ---------------------------------------------------------------------------
  // Bulk generator
  // ---------------------------------------------------------------------------

  /**
   * Confirm con preview del plan. Si ya hay periodos del mismo type
   * en el año seleccionado, lo decimos explícitamente — el BE
   * responderá 409 si los rangos colisionan, pero el plan lo decide
   * el admin.
   */
  protected async openBulkPreview(): Promise<void> {
    const year = this.resolvedYear();
    if (!year) return;
    const type = this.bulkType();

    const plan = planBulkPeriods(year.startDate, year.endDate, type);

    const existingSameType = this.periods().filter(
      (p) => p.academicYearPublicUuid === year.publicUuid && p.periodType === type,
    ).length;

    const lines = plan.parts.map(
      (p) => `  • ${p.name} → ${this.formatDate(p.startDate)} - ${this.formatDate(p.endDate)}`,
    );
    const header =
      existingSameType > 0
        ? `Ya existen ${existingSameType} periodo(s) de tipo ${PERIOD_TYPE_LABELS[type]}.\n` +
          'El backend rechazará los duplicados o solapamientos. ¿Continuar?\n\n'
        : `Se crearán ${plan.parts.length} periodos de tipo ${PERIOD_TYPE_LABELS[type]}:\n\n`;

    const ok = confirm(header + lines.join('\n'));
    if (!ok) return;

    const bulkInput = plan.parts.map((p) => ({
      ordinal: p.ordinal,
      name: p.name,
      startDate: toLocalDateString(p.startDate),
      endDate: toLocalDateString(p.endDate),
      periodType: type,
    }));

    const result = await this.store.createPeriodsBulk(year.publicUuid, bulkInput);
    if (!result.success && result.failedAt !== undefined) {
      alert(
        `Se crearon ${result.failedAt - 1} periodo(s) y luego falló.\n` +
          'Revisa el banner de error y reintenta el resto manualmente.',
      );
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  protected periodTypeLabel(t: PeriodType | null): string {
    return t ? PERIOD_TYPE_LABELS[t] : '';
  }

  protected statusLabel(status: AcademicYearStatus): string {
    switch (status) {
      case AcademicYearStatus.Planning:
        return 'Planificación';
      case AcademicYearStatus.Active:
        return 'Activo';
      case AcademicYearStatus.Closed:
        return 'Cerrado';
    }
  }

  protected formatDate(d: Date): string {
    return d.toLocaleDateString('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async applyServerFilters(): Promise<void> {
    await this.store.applyPeriodFilters({
      academicYearPublicUuid: this.yearFilter() ?? undefined,
      periodType: this.typeFilter() ?? undefined,
    });
  }

  private async syncAndReload(): Promise<void> {
    this.syncUrl();
    await this.applyServerFilters();
  }

  private syncUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        yearId: this.yearFilter() || null,
        periodType: this.typeFilter() ?? null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private parsePeriodType(value: string | null): PeriodType | null {
    if (!value) return null;
    return (Object.values(PeriodType) as string[]).includes(value) ? (value as PeriodType) : null;
  }

  /**
   * Construye un {@link AcademicPeriodDetail} a partir del row ya
   * cargado en el store + el {@code name} del año (lookup local).
   * Evitamos un fetch extra al backend porque el form modal no
   * depende de los timestamps de audit. Si en el futuro se necesita
   * data completa, agregar {@code loadPeriodDetail} al store.
   */
  private fetchDetail(publicUuid: string): AcademicPeriodDetail | null {
    const row = this.periods().find((p) => p.publicUuid === publicUuid);
    if (!row) return null;
    const year = this.years().find((y) => y.publicUuid === row.academicYearPublicUuid);
    return {
      ...row,
      academicYearName: year?.name ?? '',
    };
  }
}
