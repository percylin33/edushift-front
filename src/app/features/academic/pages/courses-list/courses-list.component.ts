import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import {
  EmptyStateComponent,
  IconComponent,
  SpinnerComponent
} from '@shared/components';
import { CourseFormModalComponent } from '../../components';
import { AcademicStore } from '../../store';
import { CourseDetail, CourseRow } from '../../models';

/**
 * `/academic/courses` — listado, filtros y CRUD de cursos (BE-4.4).
 *
 * <h3>Toolbar (filtros con URL sync)</h3>
 * <ul>
 *   <li><b>Nivel</b> — opcional; persistido en {@code ?levelId}.</li>
 *   <li><b>Estado</b> — Activo / Inactivo / Todos; persistido en
 *       {@code ?isActive=true|false}.</li>
 *   <li><b>Buscar</b> — texto que matchea {@code code} y {@code name}
 *       <em>client-side</em>; persistido en {@code ?q}.</li>
 * </ul>
 *
 * <h3>Acciones por fila</h3>
 * <ul>
 *   <li><b>Toggle isActive</b>: switch inline con UI optimista. Si el
 *       backend falla, el toggle hace rollback automático y muestra el
 *       error en el banner global del store.</li>
 *   <li><b>Editar</b> abre {@link CourseFormModalComponent} con el
 *       detail completo (carga {@code GET /courses/{uuid}} para traer
 *       {@code description} + audit, no presentes en el list item).</li>
 *   <li><b>Eliminar</b> con confirm modal nativo. BE-4.7 agregará
 *       409 {@code COURSE_IN_USE_BY_ASSIGNMENTS}.</li>
 * </ul>
 */
@Component({
  selector: 'app-courses-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    EmptyStateComponent,
    IconComponent,
    SpinnerComponent,
    CourseFormModalComponent
  ],
  template: `
    <header class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <h2 class="text-lg font-semibold text-content">Cursos</h2>
        <p class="text-sm text-content-muted">
          Catálogo del workspace. Cada curso aplica a uno o más niveles
          y se asigna a docentes en BE-4.7.
        </p>
      </div>
      <button
        type="button"
        class="btn btn-primary btn-sm self-start sm:self-auto"
        (click)="openCreate()"
      >
        <app-icon name="plus" [size]="16" />
        <span class="hidden sm:inline">Nuevo curso</span>
      </button>
    </header>

    <!-- Toolbar -->
    <section class="card mb-4">
      <div class="card-body grid gap-3 sm:grid-cols-12">
        <div class="sm:col-span-4">
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
        <div class="sm:col-span-3">
          <label class="label" for="filter-active">Estado</label>
          <select
            id="filter-active"
            class="select"
            [ngModel]="activeFilter()"
            (ngModelChange)="onActiveChange($event)"
          >
            <option [ngValue]="null">Todos</option>
            <option [ngValue]="true">Activos</option>
            <option [ngValue]="false">Inactivos</option>
          </select>
        </div>
        <div class="sm:col-span-5">
          <label class="label" for="filter-search">Buscar</label>
          <input
            id="filter-search"
            type="search"
            class="input"
            placeholder="Código o nombre"
            [ngModel]="searchFilter()"
            (ngModelChange)="onSearchChange($event)"
          />
        </div>
      </div>
    </section>

    <!-- Lista -->
    <section class="card overflow-hidden">
      @if (loading() && !hasCourses()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando cursos…" />
        </div>
      } @else if (errorMessage()) {
        <div class="alert alert-danger m-5">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">No pudimos cargar los cursos.</p>
            <p class="mt-1 text-xs opacity-80">{{ errorMessage() }}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" (click)="retry()">
            Reintentar
          </button>
        </div>
      } @else if (isEmpty()) {
        <app-empty-state
          icon="book-open"
          title="Aún no hay cursos en el catálogo"
          description="Crea el primero para luego asignarlo a docentes y secciones."
        >
          <button type="button" class="btn btn-primary btn-sm" (click)="openCreate()">
            Nuevo curso
          </button>
        </app-empty-state>
      } @else if (filteredRows().length === 0) {
        <div class="px-5 py-10 text-center text-sm text-content-muted">
          Ningún curso coincide con
          <span class="font-medium text-content">"{{ searchFilter() }}"</span>.
        </div>
      } @else {
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th class="min-w-[110px]">Código</th>
                <th class="min-w-[180px]">Nombre</th>
                <th class="hidden md:table-cell">Niveles</th>
                <th class="hidden sm:table-cell text-right">Hrs/sem</th>
                <th class="hidden lg:table-cell text-right">Créditos</th>
                <th>Activo</th>
                <th class="text-right" aria-label="Acciones"></th>
              </tr>
            </thead>
            <tbody>
              @for (row of filteredRows(); track row.publicUuid) {
                <tr>
                  <td>
                    <span class="font-mono text-xs uppercase font-semibold">
                      {{ row.code }}
                    </span>
                  </td>
                  <td>
                    <p class="font-medium text-content">{{ row.name }}</p>
                    <p class="md:hidden mt-0.5 flex flex-wrap gap-1">
                      @for (lv of row.levels; track lv.publicUuid) {
                        <span class="badge badge-neutral text-[10px]">
                          {{ lv.code }}
                        </span>
                      }
                    </p>
                  </td>
                  <td class="hidden md:table-cell">
                    <div class="flex flex-wrap gap-1">
                      @for (lv of row.levels; track lv.publicUuid) {
                        <span class="badge badge-neutral text-[11px]" [title]="lv.name">
                          {{ lv.code }}
                        </span>
                      }
                    </div>
                  </td>
                  <td class="hidden sm:table-cell text-right text-content-muted">
                    {{ row.hoursPerWeek ?? '—' }}
                  </td>
                  <td class="hidden lg:table-cell text-right text-content-muted">
                    {{ row.credits ?? '—' }}
                  </td>
                  <td>
                    <button
                      type="button"
                      role="switch"
                      [attr.aria-checked]="row.isActive"
                      class="toggle"
                      [class.toggle-on]="row.isActive"
                      [disabled]="isTogglingRow(row.publicUuid)"
                      (click)="toggleActive(row)"
                      [attr.aria-label]="
                        (row.isActive ? 'Desactivar ' : 'Activar ') + row.name
                      "
                    >
                      <span class="toggle-track">
                        <span class="toggle-thumb"></span>
                      </span>
                      <span class="text-xs ml-2 hidden sm:inline">
                        {{ row.isActive ? 'Activo' : 'Inactivo' }}
                      </span>
                    </button>
                  </td>
                  <td class="text-right">
                    <div class="inline-flex items-center gap-1">
                      <a
                        [routerLink]="detailRoute(row.publicUuid)"
                        class="btn btn-ghost btn-sm"
                        [attr.aria-label]="'Ver detalle de ' + row.name"
                      >
                        <app-icon name="arrow-right" [size]="16" />
                        <span class="hidden sm:inline">Detalle</span>
                      </a>
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
      <app-course-form-modal
        [course]="editingCourse()"
        (closed)="closeModal()"
        (saved)="onSaved()"
      />
    }
  `,
  styles: [
    `
      .toggle {
        display: inline-flex;
        align-items: center;
        cursor: pointer;
        background: transparent;
        border: 0;
      }
      .toggle:disabled { cursor: wait; opacity: 0.6; }
      .toggle-track {
        position: relative;
        display: inline-block;
        width: 2.25rem;
        height: 1.25rem;
        border-radius: 9999px;
        background: rgb(var(--color-border-rgb, 209 213 219));
        transition: background-color 0.15s;
      }
      .toggle-thumb {
        position: absolute;
        top: 0.125rem;
        left: 0.125rem;
        width: 1rem;
        height: 1rem;
        border-radius: 9999px;
        background: white;
        transition: transform 0.15s;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
      }
      .toggle-on .toggle-track {
        background: rgb(var(--color-primary-600-rgb, 37 99 235));
      }
      .toggle-on .toggle-thumb {
        transform: translateX(1rem);
      }
    `
  ]
})
export class CoursesListComponent implements OnInit {
  private readonly store = inject(AcademicStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly levels = this.store.levels;
  protected readonly loading = this.store.loadingCourses;
  protected readonly saving = this.store.savingCourse;
  protected readonly hasCourses = this.store.hasCourses;
  protected readonly isEmpty = this.store.isCoursesEmpty;
  protected readonly errorMessage = this.store.error;
  protected readonly filteredRows = this.store.filteredCourses;

  protected readonly detailRoute = (publicUuid: string): string =>
    ROUTES.ACADEMIC.COURSES.detail(publicUuid);

  protected readonly levelFilter = signal<string | null>(null);
  protected readonly activeFilter = signal<boolean | null>(null);
  protected readonly searchFilter = signal<string>('');

  protected readonly showModal = signal(false);
  protected readonly editingCourse = signal<CourseDetail | null>(null);

  /** Tracking de toggles en flight para deshabilitar el switch específico. */
  protected readonly togglingIds = signal<Set<string>>(new Set());

  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  async ngOnInit(): Promise<void> {
    if (this.levels().length === 0) await this.store.loadLevels();

    const qp = this.route.snapshot.queryParamMap;
    this.levelFilter.set(qp.get('levelId'));
    const isActiveQp = qp.get('isActive');
    this.activeFilter.set(
      isActiveQp === 'true' ? true : isActiveQp === 'false' ? false : null
    );
    this.searchFilter.set(qp.get('q') ?? '');

    /* Saneamiento — si el levelId apunta a un nivel ya borrado,
     * caemos a "Todos" en vez de quedar bloqueados. */
    const levelId = this.levelFilter();
    if (levelId && !this.levels().some((l) => l.publicUuid === levelId)) {
      this.levelFilter.set(null);
    }

    this.store.setCourseSearch(this.searchFilter() || undefined);
    await this.applyServerFilters();
  }

  // ===========================================================================
  // Toolbar
  // ===========================================================================

  protected onLevelChange(value: string | null): void {
    this.levelFilter.set(value);
    void this.syncAndReload();
  }

  protected onActiveChange(value: boolean | null): void {
    this.activeFilter.set(value);
    void this.syncAndReload();
  }

  protected onSearchChange(value: string): void {
    this.searchFilter.set(value);
    this.store.setCourseSearch(value || undefined);
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.syncUrl(), 300);
  }

  protected retry(): void {
    this.store.clearError();
    void this.applyServerFilters();
  }

  // ===========================================================================
  // Row actions
  // ===========================================================================

  protected openCreate(): void {
    this.editingCourse.set(null);
    this.showModal.set(true);
  }

  protected async openEdit(row: CourseRow): Promise<void> {
    /* El list item no trae description ni audit — pedimos detail. */
    const detail = await this.store.loadCourseDetail(row.publicUuid);
    if (!detail) return;
    this.editingCourse.set(detail);
    this.showModal.set(true);
  }

  protected closeModal(): void {
    this.showModal.set(false);
    this.editingCourse.set(null);
  }

  protected async onSaved(): Promise<void> {
    this.closeModal();
    /* Refresh para reflejar el orden por name asc post-cambio. */
    await this.store.loadCourses();
  }

  protected async confirmDelete(row: CourseRow): Promise<void> {
    const ok = confirm(
      `¿Eliminar el curso "${row.code} — ${row.name}"?\n\n` +
        'Esta operación es reversible solo desde el backend. Si el curso\n' +
        'tiene asignaciones de docentes, considera desactivarlo en su lugar.'
    );
    if (!ok) return;
    await this.store.deleteCourse(row.publicUuid);
  }

  protected async toggleActive(row: CourseRow): Promise<void> {
    if (this.isTogglingRow(row.publicUuid)) return;
    this.togglingIds.update((s) => new Set(s).add(row.publicUuid));
    try {
      await this.store.toggleCourseActive(row.publicUuid);
    }
    finally {
      this.togglingIds.update((s) => {
        const n = new Set(s);
        n.delete(row.publicUuid);
        return n;
      });
    }
  }

  protected isTogglingRow(publicUuid: string): boolean {
    return this.togglingIds().has(publicUuid);
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  private async applyServerFilters(): Promise<void> {
    await this.store.applyCourseFilters({
      levelPublicUuid: this.levelFilter() ?? undefined,
      isActive: this.activeFilter() ?? undefined,
      search: this.searchFilter() || undefined
    });
  }

  private async syncAndReload(): Promise<void> {
    this.syncUrl();
    await this.applyServerFilters();
  }

  private syncUrl(): void {
    const queryParams: Record<string, string | null> = {
      levelId: this.levelFilter() || null,
      isActive: this.activeFilter() === null ? null : String(this.activeFilter()),
      q: this.searchFilter() || null
    };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }
}
