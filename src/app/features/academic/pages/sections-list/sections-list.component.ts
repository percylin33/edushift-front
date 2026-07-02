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
import { ROUTES } from '@core/constants';
import { EmptyStateComponent, IconComponent, SpinnerComponent } from '@shared/components';
import { AcademicYearStatusBadgeComponent, SectionFormModalComponent } from '../../components';
import { AcademicStore } from '../../store';
import {
  AcademicYearStatus,
  Grade,
  SectionDetail,
  SectionListFilters,
  SectionRow,
  isSectionMutable,
} from '../../models';

/**
 * `/academic/sections` — listado, filtros y CRUD de secciones (BE-4.3).
 *
 * <h3>Toolbar (filtros con URL sync)</h3>
 * <ul>
 *   <li><b>Año académico</b> — default = año {@code ACTIVE}; persistido
 *       en {@code ?yearId}.</li>
 *   <li><b>Nivel</b> — opcional; persistido en {@code ?levelId}. Se
 *       oculta cuando hay un grado seleccionado (gradeId gana).</li>
 *   <li><b>Grado</b> — cascada del nivel (o todos los grades si no hay
 *       nivel filtrado); persistido en {@code ?gradeId}.</li>
 *   <li><b>Buscar</b> — texto que filtra <em>client-side</em> por
 *       {@code name} (el backend no acepta {@code ?q}); persistido en
 *       {@code ?q}.</li>
 * </ul>
 *
 * <h3>Acciones</h3>
 * <ul>
 *   <li><b>Nueva sección</b> — abre {@link SectionFormModalComponent}
 *       con los filtros actuales como defaults.</li>
 *   <li><b>Click en fila</b> → navega a la vista detail (FE-4.3 stub
 *       con tabs Info / Roster / Docentes).</li>
 *   <li><b>Editar / Eliminar</b> — botones por fila; deshabilitados si
 *       el año de la sección está {@code CLOSED} (BE responde 409
 *       {@code ACADEMIC_YEAR_LOCKED}).</li>
 * </ul>
 */
@Component({
  selector: 'app-sections-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    EmptyStateComponent,
    IconComponent,
    SpinnerComponent,
    AcademicYearStatusBadgeComponent,
    SectionFormModalComponent,
  ],
  template: `
    <header class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <h2 class="text-lg font-semibold text-content">Secciones</h2>
        <p class="text-sm text-content-muted">
          Subdivisiones de un grado dentro de un año académico (ej.
          <span class="font-medium">1ro Primaria — A</span>).
        </p>
      </div>
      <button
        type="button"
        class="btn btn-primary btn-sm self-start sm:self-auto"
        [disabled]="!canCreate()"
        (click)="openCreate()"
        [title]="canCreate() ? '' : 'Solo se pueden crear secciones en años PLANNING o ACTIVE'"
      >
        <app-icon name="plus" [size]="16" />
        <span class="hidden sm:inline">Nueva sección</span>
      </button>
    </header>

    <!-- Toolbar -->
    <section class="card mb-4">
      <div class="card-body grid gap-3 sm:grid-cols-12">
        <div class="sm:col-span-3">
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
        @if (!gradeFilter()) {
          <div class="sm:col-span-3">
            <label class="label" for="filter-level">Nivel</label>
            <select
              id="filter-level"
              class="select"
              [ngModel]="levelFilter()"
              (ngModelChange)="onLevelChange($event)"
            >
              <option [ngValue]="null">Todos</option>
              @for (l of levels(); track l.publicUuid) {
                <option [ngValue]="l.publicUuid">{{ l.name }}</option>
              }
            </select>
          </div>
        }
        <div class="sm:col-span-3">
          <label class="label" for="filter-grade">Grado</label>
          <select
            id="filter-grade"
            class="select"
            [ngModel]="gradeFilter()"
            (ngModelChange)="onGradeChange($event)"
          >
            <option [ngValue]="null">Todos</option>
            @for (g of gradesForFilter(); track g.publicUuid) {
              <option [ngValue]="g.publicUuid">{{ g.label }}</option>
            }
          </select>
        </div>
        <div [class.sm:col-span-3]="!gradeFilter()" [class.sm:col-span-6]="!!gradeFilter()">
          <label class="label" for="filter-search">Buscar</label>
          <input
            id="filter-search"
            type="search"
            class="input"
            placeholder="Nombre de la sección"
            [ngModel]="searchFilter()"
            (ngModelChange)="onSearchChange($event)"
          />
        </div>
      </div>
    </section>

    <!-- Lista -->
    <section class="card overflow-hidden">
      @if (loading() && !hasSections()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando secciones…" />
        </div>
      } @else if (errorMessage()) {
        <div class="alert alert-danger m-5">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">No pudimos cargar las secciones.</p>
            <p class="mt-1 text-xs opacity-80">{{ errorMessage() }}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" (click)="retry()">Reintentar</button>
        </div>
      } @else if (isEmpty()) {
        <app-empty-state
          icon="columns"
          title="No hay secciones para los filtros seleccionados"
          description="Ajusta los filtros o crea una nueva sección para empezar."
        >
          @if (canCreate()) {
            <button type="button" class="btn btn-primary btn-sm" (click)="openCreate()">
              Nueva sección
            </button>
          }
        </app-empty-state>
      } @else if (filteredRows().length === 0) {
        <div class="px-5 py-10 text-center text-sm text-content-muted">
          Ninguna sección coincide con
          <span class="font-medium text-content">"{{ searchFilter() }}"</span>.
        </div>
      } @else {
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th class="min-w-[140px]">Nombre</th>
                <th class="hidden md:table-cell">Grado</th>
                <th class="hidden lg:table-cell">Nivel</th>
                <th class="hidden md:table-cell">Año</th>
                <th class="hidden sm:table-cell">Capacidad</th>
                <th class="text-right" aria-label="Acciones"></th>
              </tr>
            </thead>
            <tbody>
              @for (row of filteredRows(); track row.publicUuid) {
                <tr class="hover:bg-surface-hover cursor-pointer" (click)="goToDetail(row)">
                  <td>
                    <p class="font-medium text-content">{{ row.name }}</p>
                    <p class="text-xs text-content-muted md:hidden">
                      {{ row.gradeName }} · {{ row.levelCode }}
                    </p>
                  </td>
                  <td class="hidden text-content-muted md:table-cell">
                    {{ row.gradeName }}
                  </td>
                  <td class="hidden text-content-muted lg:table-cell">
                    {{ row.levelCode }}
                  </td>
                  <td class="hidden md:table-cell">
                    <div class="flex items-center gap-2">
                      <span class="text-content-muted">{{ row.academicYearName }}</span>
                      <app-academic-year-status-badge [status]="row.academicYearStatus" />
                    </div>
                  </td>
                  <td class="hidden text-content-muted sm:table-cell">
                    {{ row.capacity ?? '—' }}
                  </td>
                  <td class="text-right" (click)="$event.stopPropagation()">
                    <div class="inline-flex items-center gap-1">
                      @if (canMutate(row)) {
                        <button
                          type="button"
                          class="btn btn-ghost btn-sm"
                          [disabled]="saving()"
                          (click)="openEdit(row)"
                          [attr.aria-label]="'Editar ' + row.name"
                        >
                          <app-icon name="edit-2" [size]="16" />
                          <span class="hidden sm:inline">Editar</span>
                        </button>
                        <button
                          type="button"
                          class="btn btn-ghost btn-sm text-danger-600 hover:bg-danger-50"
                          [disabled]="saving()"
                          (click)="confirmDelete(row)"
                          [attr.aria-label]="'Eliminar ' + row.name"
                        >
                          <app-icon name="trash-2" [size]="16" />
                          <span class="hidden sm:inline">Eliminar</span>
                        </button>
                      } @else {
                        <span
                          class="text-xs italic text-content-muted"
                          title="Año cerrado: las secciones quedan en modo lectura"
                        >
                          Solo lectura
                        </span>
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

    @if (showModal()) {
      <app-section-form-modal
        [section]="editingSection()"
        [defaultYearUuid]="yearFilter()"
        [defaultLevelUuid]="levelFilter()"
        [defaultGradeUuid]="gradeFilter()"
        (closed)="closeModal()"
        (saved)="onSaved()"
      />
    }
  `,
})
export class SectionsListComponent implements OnInit {
  private readonly store = inject(AcademicStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly years = this.store.years;
  protected readonly levels = this.store.levels;
  protected readonly currentActive = this.store.currentActive;
  protected readonly loading = this.store.loadingSections;
  protected readonly saving = this.store.savingSection;
  protected readonly hasSections = this.store.hasSections;
  protected readonly isEmpty = this.store.isSectionsEmpty;
  protected readonly errorMessage = this.store.error;
  protected readonly filteredRows = this.store.filteredSections;

  /** Mirror local de los queryParams para binding two-way con la toolbar. */
  protected readonly yearFilter = signal<string | null>(null);
  protected readonly levelFilter = signal<string | null>(null);
  protected readonly gradeFilter = signal<string | null>(null);
  protected readonly searchFilter = signal<string>('');

  protected readonly showModal = signal(false);
  protected readonly editingSection = signal<SectionDetail | null>(null);

  /** Debounce simple para el text search → loadSections() innecesario. */
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  /**
   * Catálogo de grades para el dropdown:
   * <ul>
   *   <li>Si hay nivel seleccionado: solo grades de ese nivel.</li>
   *   <li>Si no: todos los grades, etiquetados con su nivel para
   *       desambiguar (ej. "1ro · INICIAL" vs "1ro · PRIMARIA").</li>
   * </ul>
   */
  protected readonly gradesForFilter = computed<Array<Grade & { label: string }>>(() => {
    const levelId = this.levelFilter();
    const all = this.levels();
    if (levelId) {
      const owner = all.find((l) => l.publicUuid === levelId);
      if (!owner) return [];
      return owner.grades
        .slice()
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((g) => ({ ...g, label: g.name }));
    }
    return all.flatMap((l) => l.grades.map((g) => ({ ...g, label: `${g.name} · ${l.code}` })));
  });

  /**
   * Año del filtro (resuelto). Si el usuario no eligió uno explícito,
   * usa el {@code ACTIVE}. Se usa para decidir si "Nueva sección" está
   * habilitado.
   */
  private readonly resolvedYear = computed(() => {
    const id = this.yearFilter();
    if (id) return this.years().find((y) => y.publicUuid === id) ?? null;
    return this.currentActive() ?? null;
  });

  protected readonly canCreate = computed(() => {
    const y = this.resolvedYear();
    return y ? isSectionMutable(y.status) : false;
  });

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  async ngOnInit(): Promise<void> {
    /* Hidrata catálogos auxiliares (años, niveles+grados). Si ya están
     * en memoria evitamos refetches. */
    if (this.years().length === 0) await this.store.loadYears();
    if (this.levels().length === 0) await this.store.loadLevels();

    /* Lee URL queryParams y aplica como filtros iniciales. */
    const qp = this.route.snapshot.queryParamMap;
    this.yearFilter.set(qp.get('yearId'));
    this.levelFilter.set(qp.get('levelId'));
    this.gradeFilter.set(qp.get('gradeId'));
    this.searchFilter.set(qp.get('q') ?? '');

    /* Sanea filtros incoherentes (ej. levelId que ya no existe). El
     * backend hace su propia validación pero limpiamos client-side
     * para que la toolbar no quede en estado roto. */
    this.sanitizeFilters();

    await this.applyServerFilters();
  }

  // ===========================================================================
  // Toolbar handlers
  // ===========================================================================

  protected onYearChange(value: string | null): void {
    this.yearFilter.set(value);
    void this.syncAndReload();
  }

  protected onLevelChange(value: string | null): void {
    this.levelFilter.set(value);
    /* Si el grade actual no pertenece al nuevo level, resetea grade. */
    const gradeId = this.gradeFilter();
    if (value && gradeId) {
      const owner = this.levels().find((l) => l.publicUuid === value);
      if (!owner?.grades.some((g) => g.publicUuid === gradeId)) {
        this.gradeFilter.set(null);
      }
    }
    void this.syncAndReload();
  }

  protected onGradeChange(value: string | null): void {
    this.gradeFilter.set(value);
    /* Si el grade impone un level, sincroniza el filtro de level
     * para que la toolbar muestre el contexto correcto. */
    if (value) {
      const owner = this.levels().find((l) => l.grades.some((g) => g.publicUuid === value));
      if (owner) this.levelFilter.set(owner.publicUuid);
    }
    void this.syncAndReload();
  }

  protected onSearchChange(value: string): void {
    this.searchFilter.set(value);
    this.store.setSectionSearch(value || undefined);
    /* La búsqueda es client-side: solo escribimos a la URL. No hace
     * falta refetch al backend. Debounce ligero para evitar spam de
     * navigate(). */
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.syncUrl(), 300);
  }

  protected retry(): void {
    this.store.clearError();
    void this.applyServerFilters();
  }

  // ===========================================================================
  // Acciones
  // ===========================================================================

  protected openCreate(): void {
    this.editingSection.set(null);
    this.showModal.set(true);
  }

  protected async openEdit(row: SectionRow): Promise<void> {
    /* Cargamos el detail completo (incluye levelName + audit). */
    const detail = await this.store.loadSectionDetail(row.publicUuid);
    if (!detail) return;
    this.editingSection.set(detail);
    this.showModal.set(true);
  }

  protected closeModal(): void {
    this.showModal.set(false);
    this.editingSection.set(null);
  }

  protected async onSaved(): Promise<void> {
    this.closeModal();
    /* Refresca para reflejar los cambios bajo los filtros vigentes
     * (un PUT que cambia el name puede afectar el orden). */
    await this.store.loadSections();
  }

  protected async confirmDelete(row: SectionRow): Promise<void> {
    const ok = confirm(
      `¿Eliminar la sección "${row.gradeName} ${row.name}" del año "${row.academicYearName}"?\n\n` +
        'Esta operación es reversible solo desde el backend.',
    );
    if (!ok) return;
    await this.store.deleteSection(row.publicUuid);
  }

  protected goToDetail(row: SectionRow): void {
    void this.router.navigate([ROUTES.ACADEMIC.SECTIONS.detail(row.publicUuid)]);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  protected canMutate(row: SectionRow): boolean {
    return isSectionMutable(row.academicYearStatus);
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

  /**
   * Aplica filtros server-side y dispara el refetch. Coordina el
   * snapshot que la store usa para futuras refetches.
   */
  private async applyServerFilters(): Promise<void> {
    const filters: SectionListFilters = {
      academicYearPublicUuid: this.yearFilter() ?? undefined,
      levelPublicUuid: this.levelFilter() ?? undefined,
      gradePublicUuid: this.gradeFilter() ?? undefined,
      search: this.searchFilter() || undefined,
    };
    await this.store.applySectionFilters(filters);
  }

  /**
   * Sincroniza filtros con URL queryParams + dispara fetch. Usado
   * cuando cambia un filtro server-side (year/level/grade).
   */
  private async syncAndReload(): Promise<void> {
    this.syncUrl();
    await this.applyServerFilters();
  }

  private syncUrl(): void {
    const queryParams: Record<string, string | null> = {
      yearId: this.yearFilter() || null,
      levelId: this.levelFilter() || null,
      gradeId: this.gradeFilter() || null,
      q: this.searchFilter() || null,
    };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /**
   * Limpia filtros referenciando entidades que ya no existen en el
   * tenant (ej. el level fue borrado o cambió). Mejor degradar a
   * "Todos" que mostrar la toolbar bloqueada con un id huérfano.
   */
  private sanitizeFilters(): void {
    const yearId = this.yearFilter();
    if (yearId && !this.years().some((y) => y.publicUuid === yearId)) {
      this.yearFilter.set(null);
    }
    const levelId = this.levelFilter();
    if (levelId && !this.levels().some((l) => l.publicUuid === levelId)) {
      this.levelFilter.set(null);
    }
    const gradeId = this.gradeFilter();
    if (gradeId && !this.levels().some((l) => l.grades.some((g) => g.publicUuid === gradeId))) {
      this.gradeFilter.set(null);
    }
  }
}
