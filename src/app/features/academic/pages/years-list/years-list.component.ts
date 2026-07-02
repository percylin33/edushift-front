import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { EmptyStateComponent, IconComponent, SpinnerComponent } from '@shared/components';
import { AcademicYearStatusBadgeComponent } from '../../components';
import { AcademicStore } from '../../store';
import { AcademicYearRow, AcademicYearStatus, isYearMutable } from '../../models';

/**
 * `/academic/years` — listado y operaciones del sub-módulo
 * {@code academic.year} (BE-4.1).
 *
 * <h3>Layout</h3>
 * <ol>
 *   <li><b>Header local</b> — título de la sub-sección (el header
 *       global "Académico" lo monta {@code AcademicShellComponent}) y
 *       acción primaria "Nuevo año".</li>
 *   <li><b>Filtro</b> — selector de status (PLANNING / ACTIVE / CLOSED
 *       / Todos). Backend ordena por status+startDate desc.</li>
 *   <li><b>Tabla</b> — nombre, ventana de fechas, status badge y
 *       acciones contextuales: editar, activar, eliminar. Los botones
 *       se deshabilitan según el status (CLOSED es terminal: ni
 *       edit ni activate ni delete).</li>
 * </ol>
 *
 * <p>El componente <strong>no</strong> hace fetches: lee/escribe a
 * través de {@link AcademicStore}, igual que las demás features.</p>
 */
@Component({
  selector: 'app-years-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    EmptyStateComponent,
    IconComponent,
    SpinnerComponent,
    AcademicYearStatusBadgeComponent,
  ],
  template: `
    <header class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <h2 class="text-lg font-semibold text-content">Años académicos</h2>
        <p class="text-sm text-content-muted">
          Define el calendario lectivo del workspace. A lo más un año puede estar activo a la vez.
        </p>
      </div>
      <a [routerLink]="newRoute" class="btn btn-primary btn-sm self-start sm:self-auto">
        <app-icon name="plus" [size]="16" />
        <span class="hidden sm:inline">Nuevo año</span>
      </a>
    </header>

    <!-- Filtro -->
    <section class="card mb-4">
      <div class="card-body grid gap-3 sm:grid-cols-12">
        <div class="sm:col-span-4">
          <label class="label" for="years-status">Estado</label>
          <select
            id="years-status"
            class="select"
            [ngModel]="statusFilter()"
            (ngModelChange)="onStatusChange($event)"
          >
            <option [ngValue]="null">Todos</option>
            @for (opt of statusOptions; track opt.value) {
              <option [ngValue]="opt.value">{{ opt.label }}</option>
            }
          </select>
        </div>
        <div class="flex items-end sm:col-span-8">
          @if (currentActive(); as active) {
            <p class="text-xs text-content-muted">
              Año activo:
              <span class="font-medium text-content">{{ active.name }}</span>
              · {{ formatDate(active.startDate) }} — {{ formatDate(active.endDate) }}
            </p>
          } @else if (!loading()) {
            <p class="text-xs italic text-content-muted">
              Aún no hay un año activo. Activa uno desde la tabla para empezar a operar.
            </p>
          }
        </div>
      </div>
    </section>

    <!-- Lista -->
    <section class="card overflow-hidden">
      @if (loading() && !hasYears()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando años académicos…" />
        </div>
      } @else if (errorMessage()) {
        <div class="alert alert-danger m-5">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">No pudimos cargar la lista.</p>
            <p class="mt-1 text-xs opacity-80">{{ errorMessage() }}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" (click)="retry()">Reintentar</button>
        </div>
      } @else if (isEmpty()) {
        <app-empty-state
          icon="calendar"
          title="Aún no hay años académicos"
          description="Crea el primero para habilitar matrícula, secciones y periodos."
        >
          <a [routerLink]="newRoute" class="btn btn-primary btn-sm">Nuevo año</a>
        </app-empty-state>
      } @else {
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th class="min-w-[200px]">Año</th>
                <th class="hidden md:table-cell">Inicio</th>
                <th class="hidden md:table-cell">Fin</th>
                <th>Estado</th>
                <th class="text-right" aria-label="Acciones"></th>
              </tr>
            </thead>
            <tbody>
              @for (year of years(); track year.publicUuid) {
                <tr>
                  <td>
                    <a
                      [routerLink]="editLink(year.publicUuid)"
                      class="block font-medium text-content hover:text-primary-600"
                      [class.pointer-events-none]="!canEdit(year)"
                      [class.opacity-60]="!canEdit(year)"
                    >
                      {{ year.name }}
                    </a>
                    <p class="text-xs text-content-muted md:hidden">
                      {{ formatDate(year.startDate) }} → {{ formatDate(year.endDate) }}
                    </p>
                  </td>
                  <td class="hidden text-content-muted md:table-cell">
                    {{ formatDate(year.startDate) }}
                  </td>
                  <td class="hidden text-content-muted md:table-cell">
                    {{ formatDate(year.endDate) }}
                  </td>
                  <td>
                    <app-academic-year-status-badge [status]="year.status" />
                  </td>
                  <td class="text-right">
                    <div class="inline-flex items-center gap-1">
                      @if (canActivate(year)) {
                        <button
                          type="button"
                          class="btn btn-outline btn-sm"
                          [disabled]="saving()"
                          (click)="activate(year)"
                          [attr.aria-label]="'Activar ' + year.name"
                        >
                          <app-icon name="check" [size]="16" />
                          <span class="hidden sm:inline">Activar</span>
                        </button>
                      }
                      @if (canEdit(year)) {
                        <a
                          [routerLink]="editLink(year.publicUuid)"
                          class="btn btn-ghost btn-sm"
                          aria-label="Editar"
                        >
                          <app-icon name="edit-2" [size]="16" />
                          <span class="hidden sm:inline">Editar</span>
                        </a>
                      }
                      @if (canDelete(year)) {
                        <button
                          type="button"
                          class="btn btn-ghost btn-sm text-danger-600 hover:bg-danger-50"
                          [disabled]="saving()"
                          (click)="confirmDelete(year)"
                          [attr.aria-label]="'Eliminar ' + year.name"
                        >
                          <app-icon name="trash-2" [size]="16" />
                          <span class="hidden sm:inline">Eliminar</span>
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
  `,
})
export class YearsListComponent implements OnInit {
  private readonly store = inject(AcademicStore);

  protected readonly newRoute = ROUTES.ACADEMIC.YEARS.NEW;

  protected readonly statusFilter = signal<AcademicYearStatus | null>(null);

  protected readonly years = this.store.years;
  protected readonly hasYears = this.store.hasYears;
  protected readonly isEmpty = this.store.isYearsEmpty;
  protected readonly loading = this.store.loadingYears;
  protected readonly saving = this.store.savingYear;
  protected readonly currentActive = this.store.currentActive;
  protected readonly errorMessage = this.store.error;

  protected readonly statusOptions: ReadonlyArray<{
    value: AcademicYearStatus;
    label: string;
  }> = [
    { value: AcademicYearStatus.Planning, label: 'Planificación' },
    { value: AcademicYearStatus.Active, label: 'Activo' },
    { value: AcademicYearStatus.Closed, label: 'Cerrado' },
  ];

  ngOnInit(): void {
    /* Hidrata el filtro local desde el store: navegar de vuelta desde
     * el form preserva la elección del admin. */
    const f = this.store.yearFilters();
    this.statusFilter.set(f.status ?? null);

    if (this.store.years().length === 0) {
      void this.store.loadYears();
    }
  }

  // ===========================================================================
  // Filtros
  // ===========================================================================

  protected onStatusChange(value: AcademicYearStatus | null): void {
    this.statusFilter.set(value);
    void this.store.applyYearFilters({ status: value ?? undefined });
  }

  protected retry(): void {
    this.store.clearError();
    void this.store.loadYears();
  }

  // ===========================================================================
  // Acciones por fila
  // ===========================================================================

  protected canEdit(year: AcademicYearRow): boolean {
    return isYearMutable(year.status);
  }

  protected canActivate(year: AcademicYearRow): boolean {
    return year.status === AcademicYearStatus.Planning;
  }

  /**
   * Solo permitimos borrar años en {@code PLANNING}: el backend
   * rechaza {@code ACTIVE} con 409 {@code ACADEMIC_YEAR_IN_USE} y
   * {@code CLOSED} es terminal (no tiene sentido borrar histórico).
   */
  protected canDelete(year: AcademicYearRow): boolean {
    return year.status === AcademicYearStatus.Planning;
  }

  protected async activate(year: AcademicYearRow): Promise<void> {
    const current = this.currentActive();
    if (current && current.publicUuid !== year.publicUuid) {
      const ok = confirm(
        `Activar "${year.name}" cerrará automáticamente el año activo "${current.name}".\n\n¿Continuar?`,
      );
      if (!ok) return;
    }
    await this.store.activateYear(year.publicUuid);
  }

  protected async confirmDelete(year: AcademicYearRow): Promise<void> {
    const ok = confirm(
      `¿Eliminar el año "${year.name}"?\n\nEsta operación es reversible solo desde el backend.`,
    );
    if (!ok) return;
    await this.store.deleteYear(year.publicUuid);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  protected editLink(publicUuid: string): string {
    return ROUTES.ACADEMIC.YEARS.edit(publicUuid);
  }

  protected formatDate(date: Date | undefined): string {
    if (!date) return '—';
    return date.toLocaleDateString('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
