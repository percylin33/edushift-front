import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { EnrollmentStatus } from '@core/enums';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent
} from '@shared/components';
import { AcademicApiService } from '@features/academic/services';
import {
  AcademicYearRow,
  AcademicYearStatus,
  SectionRow
} from '@features/academic/models';
import {
  BulkImportModalComponent,
  EnrollmentStatusBadgeComponent
} from '../../components';
import { StudentsStore } from '../../store';
import { StudentListFilters } from '../../models';

/**
 * `/students` — list page for the students module.
 *
 * <h3>Layout</h3>
 * Three sections inside the standard {@code PageContainer}:
 * <ol>
 *   <li><b>Header</b> — page title + primary actions (create, bulk
 *       import). Bulk import opens an in-page modal that delegates to
 *       {@link BulkImportModalComponent}.</li>
 *   <li><b>Filters</b> — debounced text search across
 *       firstName/lastName/documentNumber + an exact-match enrollment
 *       status select. Local state lives in this component; we push
 *       the snapshot into the store via
 *       {@link StudentsStore#applyFilters}.</li>
 *   <li><b>Table</b> — name + document + status + enrolment date,
 *       with pagination footer. Wide screens see all columns; narrow
 *       ones collapse the secondary columns.</li>
 * </ol>
 *
 * <p>Component holds no fetched data of its own — every signal it
 * reads comes from {@link StudentsStore}, which keeps optimistic
 * updates and pagination math in one place.
 */
@Component({
  selector: 'app-students-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    EmptyStateComponent,
    IconComponent,
    SpinnerComponent,
    EnrollmentStatusBadgeComponent,
    BulkImportModalComponent
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header
        title="Estudiantes"
        subtitle="Listado activo del workspace, con filtros y carga masiva."
      >
        <button type="button" class="btn btn-outline btn-sm" (click)="openBulkModal()">
          <app-icon name="upload" [size]="16" />
          <span class="hidden sm:inline">Importar</span>
        </button>
        <a [routerLink]="newRoute" class="btn btn-primary btn-sm">
          <app-icon name="plus" [size]="16" />
          <span class="hidden sm:inline">Nuevo estudiante</span>
        </a>
      </app-page-header>

      <!-- Filtros -->
      <section class="card mb-4">
        <div class="card-body grid gap-3 sm:grid-cols-12">
          <div class="sm:col-span-6">
            <label class="label" for="students-search">Buscar</label>
            <div class="relative">
              <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-content-subtle">
                <app-icon name="search" [size]="16" />
              </span>
              <input
                id="students-search"
                type="search"
                class="input pl-9"
                placeholder="Nombre, apellido o documento…"
                [ngModel]="search()"
                (ngModelChange)="onSearchChange($event)"
              />
            </div>
          </div>

          <div class="sm:col-span-3">
            <label class="label" for="students-status">Matrícula</label>
            <select
              id="students-status"
              class="select"
              [ngModel]="enrollmentStatus()"
              (ngModelChange)="onStatusChange($event)"
            >
              <option [ngValue]="null">Todos</option>
              @for (opt of statusOptions; track opt.value) {
                <option [ngValue]="opt.value">{{ opt.label }}</option>
              }
            </select>
          </div>

          <div class="sm:col-span-3">
            <label class="label" for="students-section">Sección actual</label>
            <select
              id="students-section"
              class="select"
              [ngModel]="currentSectionId()"
              (ngModelChange)="onCurrentSectionChange($event)"
              [disabled]="loadingSections() || sections().length === 0"
            >
              <option [ngValue]="null">Todas</option>
              @for (s of sections(); track s.publicUuid) {
                <option [ngValue]="s.publicUuid">
                  {{ s.gradeName }} · {{ s.name }}
                </option>
              }
            </select>
            @if (!loadingSections() && !activeYear()) {
              <p class="hint mt-1 text-xs text-content-muted">
                Sin año activo
              </p>
            }
          </div>
        </div>
      </section>

      <!-- Lista -->
      <section class="card overflow-hidden">
        @if (loading() && !hasItems()) {
          <div class="flex items-center justify-center py-16">
            <app-spinner [size]="24" label="Cargando estudiantes…" />
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
            icon="graduation-cap"
            title="Aún no hay estudiantes"
            description="Crea el primero o cárgalos en lote desde un .xlsx.">
            <a [routerLink]="newRoute" class="btn btn-primary btn-sm">Nuevo estudiante</a>
            <button type="button" class="btn btn-ghost btn-sm" (click)="openBulkModal()">
              Importar .xlsx
            </button>
          </app-empty-state>
        } @else {
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th class="min-w-[220px]">Estudiante</th>
                  <th class="hidden md:table-cell">Documento</th>
                  <th class="hidden lg:table-cell">Email</th>
                  <th>Matrícula</th>
                  <th class="hidden lg:table-cell">Fecha</th>
                  <th class="text-right" aria-label="Acciones"></th>
                </tr>
              </thead>
              <tbody>
                @for (student of items(); track student.publicUuid) {
                  <tr>
                    <td>
                      <a
                        [routerLink]="detailLink(student.publicUuid)"
                        class="block font-medium text-content hover:text-primary-600"
                      >
                        {{ student.fullName }}
                      </a>
                      <p class="md:hidden text-xs text-content-muted">
                        {{ student.documentType }} · {{ student.documentNumber }}
                      </p>
                    </td>
                    <td class="hidden md:table-cell text-content-muted">
                      <span class="font-mono text-xs">{{ student.documentType }}</span>
                      <span class="ml-2">{{ student.documentNumber }}</span>
                    </td>
                    <td class="hidden lg:table-cell text-content-muted">
                      {{ student.email ?? '—' }}
                    </td>
                    <td>
                      <app-enrollment-status-badge [status]="student.enrollmentStatus" />
                    </td>
                    <td class="hidden lg:table-cell text-content-muted">
                      {{ formatDate(student.enrollmentDate) }}
                    </td>
                    <td class="text-right">
                      <div class="flex items-center justify-end gap-1">
                        <a
                          [routerLink]="qrLink(student.publicUuid)"
                          class="btn btn-ghost btn-sm"
                          [attr.aria-label]="'Generar credencial QR de ' + student.fullName"
                          title="Credencial QR"
                          data-testid="student-qr-link"
                        >
                          <app-icon name="qr-code" [size]="16" />
                        </a>
                        <a
                          [routerLink]="detailLink(student.publicUuid)"
                          class="btn btn-ghost btn-sm"
                          aria-label="Ver detalle"
                        >
                          <span class="hidden sm:inline">Ver</span>
                          <app-icon name="chevron-right" [size]="16" />
                        </a>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <footer
            class="flex flex-col items-center justify-between gap-3 border-t border-border-subtle px-5 py-3 sm:flex-row"
          >
            <p class="text-xs text-content-muted">
              Página
              <span class="font-medium text-content">{{ pagination().page + 1 }}</span>
              de
              <span class="font-medium text-content">{{ Math.max(pagination().totalPages, 1) }}</span>
              · {{ pagination().totalElements }} estudiantes
            </p>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="btn btn-outline btn-sm"
                [disabled]="!canPrev() || loading()"
                (click)="prev()"
              >
                <app-icon name="chevron-left" [size]="16" />
                <span class="hidden sm:inline">Anterior</span>
              </button>
              <button
                type="button"
                class="btn btn-outline btn-sm"
                [disabled]="!canNext() || loading()"
                (click)="next()"
              >
                <span class="hidden sm:inline">Siguiente</span>
                <app-icon name="chevron-right" [size]="16" />
              </button>
            </div>
          </footer>
        }
      </section>

      @if (bulkOpen()) {
        <app-bulk-import-modal (closed)="closeBulkModal()" />
      }
    </app-page-container>
  `
})
export class StudentsListComponent implements OnInit {
  private readonly store = inject(StudentsStore);
  private readonly academicApi = inject(AcademicApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly Math = Math;
  protected readonly newRoute = ROUTES.STUDENTS.NEW;

  protected readonly search = signal<string>('');
  protected readonly enrollmentStatus = signal<EnrollmentStatus | null>(null);
  protected readonly currentSectionId = signal<string | null>(null);
  protected readonly bulkOpen = signal(false);

  /** Año académico ACTIVE — gateway del filtro currentSectionId. */
  protected readonly activeYear = signal<AcademicYearRow | null>(null);
  protected readonly sections = signal<SectionRow[]>([]);
  protected readonly loadingSections = signal<boolean>(false);

  protected readonly items = this.store.items;
  protected readonly hasItems = this.store.hasItems;
  protected readonly isEmpty = this.store.isEmpty;
  protected readonly loading = this.store.loading;
  protected readonly pagination = this.store.pagination;
  protected readonly errorMessage = this.store.error;

  protected readonly canPrev = computed(() => this.pagination().page > 0);
  protected readonly canNext = computed(() => {
    const { page, totalPages } = this.pagination();
    return page + 1 < totalPages;
  });

  protected readonly statusOptions: ReadonlyArray<{
    value: EnrollmentStatus;
    label: string;
  }> = [
    { value: EnrollmentStatus.Pending,     label: 'Pendiente' },
    { value: EnrollmentStatus.Enrolled,    label: 'Matriculado' },
    { value: EnrollmentStatus.Graduated,   label: 'Egresado' },
    { value: EnrollmentStatus.Transferred, label: 'Trasladado' },
    { value: EnrollmentStatus.Withdrawn,   label: 'Retirado' }
  ];

  /** Debounce timer for the text search. Cancelled on every keystroke. */
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit(): Promise<void> {
    /* Sync inicial: query params > store snapshot > defaults.
     * Esto permite compartir URL con filtros aplicados (FE-4.7). */
    const qp = this.route.snapshot.queryParamMap;
    const storeFilters = this.store.filters();

    const searchInit = qp.get('search') ?? storeFilters.search ?? '';
    const statusRaw = qp.get('status') ?? storeFilters.enrollmentStatus;
    const sectionInit = qp.get('currentSectionId') ?? storeFilters.currentSectionId ?? null;

    this.search.set(searchInit);
    this.enrollmentStatus.set(this.parseStatus(statusRaw));
    this.currentSectionId.set(sectionInit);

    /* Cargamos secciones del año activo en paralelo al list inicial.
     * Si el filtro currentSectionId vino por URL pero el año activo
     * no responde, dejamos el filtro aplicado igual: el back lo
     * resuelve por publicUuid sin importar la lista del dropdown. */
    void this.fetchActiveYearSections();

    /* applyFilters dispara el primer load con todos los filtros
     * sincronizados — más simple que comparar y decidir. */
    await this.applyFilters({ skipUrlSync: true });
  }

  // ===========================================================================
  // Filters & pagination
  // ===========================================================================

  protected onSearchChange(value: string): void {
    this.search.set(value);
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.applyFilters(), 350);
  }

  protected onStatusChange(value: EnrollmentStatus | null): void {
    this.enrollmentStatus.set(value);
    void this.applyFilters();
  }

  protected onCurrentSectionChange(value: string | null): void {
    this.currentSectionId.set(value);
    void this.applyFilters();
  }

  protected prev(): void {
    void this.store.goToPage(this.pagination().page - 1);
  }

  protected next(): void {
    void this.store.goToPage(this.pagination().page + 1);
  }

  protected retry(): void {
    this.store.clearError();
    void this.store.loadList();
  }

  // ===========================================================================
  // Bulk import modal
  // ===========================================================================

  protected openBulkModal(): void {
    /* Don't tear down the active job — admins reopening the modal
     * mid-process should still see the in-flight progress. The store
     * resets the slice explicitly when the import is acknowledged. */
    this.bulkOpen.set(true);
  }

  protected closeBulkModal(): void {
    this.bulkOpen.set(false);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  protected detailLink(publicUuid: string): string {
    return ROUTES.STUDENTS.detail(publicUuid);
  }

  protected qrLink(publicUuid: string): string {
    return ROUTES.STUDENTS.qr(publicUuid);
  }

  protected formatDate(date: Date | undefined): string {
    if (!date) return '—';
    return date.toLocaleDateString('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  private async applyFilters(
    options: { skipUrlSync?: boolean } = {}
  ): Promise<void> {
    const filters: StudentListFilters = {
      search: this.search().trim() || undefined,
      enrollmentStatus: this.enrollmentStatus() ?? undefined,
      currentSectionId: this.currentSectionId() ?? undefined
    };
    if (!options.skipUrlSync) {
      void this.syncUrl(filters);
    }
    await this.store.applyFilters(filters);
  }

  /**
   * Refleja los filtros activos en {@code ?search&status&currentSectionId}.
   * {@code merge} preserva otros params (ej. {@code page} si lo
   * agregamos en otro sprint). {@code replaceUrl} evita ensuciar el
   * historial con cada keystroke.
   */
  private async syncUrl(filters: StudentListFilters): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        search: filters.search ?? null,
        status: filters.enrollmentStatus ?? null,
        currentSectionId: filters.currentSectionId ?? null
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  /**
   * Carga el año académico ACTIVE + sus secciones para el dropdown
   * del filtro. Si no hay año activo, el dropdown queda deshabilitado
   * con un hint inline; el usuario igualmente puede tener el filtro
   * aplicado por URL — el back resuelve por UUID.
   */
  private async fetchActiveYearSections(): Promise<void> {
    this.loadingSections.set(true);
    try {
      const years = await firstValueFrom(this.academicApi.listYears());
      const active =
        years.find((y) => y.status === AcademicYearStatus.Active) ?? null;
      this.activeYear.set(active);
      if (!active) {
        this.sections.set([]);
        return;
      }
      const sections = await firstValueFrom(
        this.academicApi.listSections({
          academicYearPublicUuid: active.publicUuid
        })
      );
      this.sections.set(sections);
    }
    catch {
      this.activeYear.set(null);
      this.sections.set([]);
    }
    finally {
      this.loadingSections.set(false);
    }
  }

  /**
   * Convierte el query param crudo (string) a {@link EnrollmentStatus}
   * verificando que sea uno de los valores válidos. Anti-XSS y
   * anti-mistype: si llega "ENROLED" mal escrito, lo descartamos.
   */
  private parseStatus(raw: string | null | undefined): EnrollmentStatus | null {
    if (!raw) return null;
    const valid = Object.values(EnrollmentStatus) as string[];
    return valid.includes(raw) ? (raw as EnrollmentStatus) : null;
  }
}
