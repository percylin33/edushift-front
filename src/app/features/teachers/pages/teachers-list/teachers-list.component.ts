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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { EmploymentStatus } from '@core/enums';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import { EmploymentStatusBadgeComponent } from '../../components';
import { TeachersStore } from '../../store';
import { EMPLOYMENT_STATUS_LABELS, TeacherListFilters } from '../../models';

/**
 * `/teachers` — list page del padrón de docentes (FE-4.6).
 *
 * <h3>Layout</h3>
 * <ol>
 *   <li><b>Header</b> — título + acciones primarias (Importar
 *       placeholder + Nuevo docente).</li>
 *   <li><b>Filtros</b> — search debounced, employmentStatus y
 *       hasUserAccount (tres-estados: Todos / Con cuenta / Sin cuenta).</li>
 *   <li><b>Tabla</b> — name + document + status badge + cuenta icon
 *       + email, con pagination footer.</li>
 * </ol>
 *
 * <h3>URL sync</h3>
 * Los filtros se sincronizan con query params
 * ({@code ?search&employmentStatus&hasUserAccount}) para que F5
 * preserve la elección y los compartibles funcionen.
 *
 * <h3>Importar (placeholder)</h3>
 * El spec lista un botón "Importar Excel". El bulk-import propio de
 * teachers no está implementado en BE-4.6 — el botón aparece como
 * placeholder con tooltip "Disponible en Sprint 5". Mantener visible
 * para que la UI conserve la jerarquía de acciones cuando el feature
 * aterrice.
 */
@Component({
  selector: 'app-teachers-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    EmptyStateComponent,
    IconComponent,
    SpinnerComponent,
    EmploymentStatusBadgeComponent,
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header
        title="Docentes"
        subtitle="Padrón de docentes del workspace, con filtros y vinculación a cuentas de usuario."
      >
        <button
          type="button"
          class="btn btn-outline btn-sm"
          [disabled]="true"
          title="Importación masiva disponible en Sprint 5"
        >
          <app-icon name="upload" [size]="16" />
          <span class="hidden sm:inline">Importar</span>
        </button>
        <a [routerLink]="newRoute" class="btn btn-primary btn-sm">
          <app-icon name="plus" [size]="16" />
          <span class="hidden sm:inline">Nuevo docente</span>
        </a>
      </app-page-header>

      <!-- Filtros -->
      <section class="card mb-4">
        <div class="card-body grid gap-3 sm:grid-cols-12">
          <div class="sm:col-span-6">
            <label class="label" for="teachers-search">Buscar</label>
            <div class="relative">
              <span
                class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-content-subtle"
              >
                <app-icon name="search" [size]="16" />
              </span>
              <input
                id="teachers-search"
                type="search"
                class="input pl-9"
                placeholder="Nombre, apellido, documento o email…"
                [ngModel]="search()"
                (ngModelChange)="onSearchChange($event)"
              />
            </div>
          </div>

          <div class="sm:col-span-3">
            <label class="label" for="teachers-status">Estado laboral</label>
            <select
              id="teachers-status"
              class="select"
              [ngModel]="employmentStatus()"
              (ngModelChange)="onStatusChange($event)"
            >
              <option [ngValue]="null">Todos</option>
              @for (opt of statusOptions; track opt.value) {
                <option [ngValue]="opt.value">{{ opt.label }}</option>
              }
            </select>
          </div>

          <div class="sm:col-span-3">
            <label class="label" for="teachers-account">Cuenta</label>
            <select
              id="teachers-account"
              class="select"
              [ngModel]="hasUserAccount()"
              (ngModelChange)="onAccountChange($event)"
            >
              <option [ngValue]="null">Todos</option>
              <option [ngValue]="true">Con cuenta</option>
              <option [ngValue]="false">Sin cuenta</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Lista -->
      <section class="card overflow-hidden">
        @if (loading() && !hasItems()) {
          <div class="flex items-center justify-center py-16">
            <app-spinner [size]="24" label="Cargando docentes…" />
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
            icon="users"
            title="Aún no hay docentes"
            description="Crea el primer docente o vincula uno a una cuenta existente."
          >
            <a [routerLink]="newRoute" class="btn btn-primary btn-sm"> Nuevo docente </a>
          </app-empty-state>
        } @else {
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th class="min-w-[220px]">Docente</th>
                  <th class="hidden md:table-cell">Documento</th>
                  <th class="hidden lg:table-cell">Email</th>
                  <th>Estado</th>
                  <th class="text-center">Cuenta</th>
                  <th class="text-right" aria-label="Acciones"></th>
                </tr>
              </thead>
              <tbody>
                @for (teacher of items(); track teacher.publicUuid) {
                  <tr>
                    <td>
                      <a
                        [routerLink]="detailLink(teacher.publicUuid)"
                        class="block font-medium text-content hover:text-primary-600"
                      >
                        {{ teacher.fullName }}
                      </a>
                      @if (teacher.title) {
                        <p class="text-xs text-content-muted">{{ teacher.title }}</p>
                      }
                      <p class="text-xs text-content-muted md:hidden">
                        {{ teacher.documentType }} · {{ teacher.documentNumber }}
                      </p>
                      @if (teacher.specializations.length > 0) {
                        <div class="mt-1 flex flex-wrap gap-1">
                          @for (s of teacher.specializations.slice(0, 3); track s) {
                            <span class="badge badge-neutral text-[0.65rem]">{{ s }}</span>
                          }
                          @if (teacher.specializations.length > 3) {
                            <span class="text-xs text-content-muted">
                              +{{ teacher.specializations.length - 3 }}
                            </span>
                          }
                        </div>
                      }
                    </td>
                    <td class="hidden text-content-muted md:table-cell">
                      <span class="font-mono text-xs">{{ teacher.documentType }}</span>
                      <span class="ml-2">{{ teacher.documentNumber }}</span>
                    </td>
                    <td class="hidden text-content-muted lg:table-cell">
                      {{ teacher.email ?? '—' }}
                    </td>
                    <td>
                      <app-employment-status-badge [status]="teacher.employmentStatus" />
                    </td>
                    <td class="text-center">
                      @if (teacher.hasUserAccount) {
                        <span
                          class="bg-success-50 text-success-600 inline-flex h-7 w-7 items-center justify-center rounded-full"
                          title="Vinculado a una cuenta de usuario"
                        >
                          <app-icon name="check" [size]="14" />
                        </span>
                      } @else {
                        <span
                          class="inline-flex items-center gap-1 text-xs text-content-muted"
                          title="Aún no tiene cuenta de usuario"
                        >
                          <app-icon name="user" [size]="14" />
                          Sin cuenta
                        </span>
                      }
                    </td>
                    <td class="text-right">
                      <a
                        [routerLink]="detailLink(teacher.publicUuid)"
                        class="btn btn-ghost btn-sm"
                        aria-label="Ver detalle"
                      >
                        <span class="hidden sm:inline">Ver</span>
                        <app-icon name="chevron-right" [size]="16" />
                      </a>
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
              <span class="font-medium text-content">
                {{ pagination().page + 1 }}
              </span>
              de
              <span class="font-medium text-content">
                {{ Math.max(pagination().totalPages, 1) }}
              </span>
              · {{ pagination().totalElements }} docentes
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
    </app-page-container>
  `,
})
export class TeachersListComponent implements OnInit {
  private readonly store = inject(TeachersStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly Math = Math;
  protected readonly newRoute = ROUTES.TEACHERS.NEW;

  protected readonly search = signal<string>('');
  protected readonly employmentStatus = signal<EmploymentStatus | null>(null);
  protected readonly hasUserAccount = signal<boolean | null>(null);

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
    value: EmploymentStatus;
    label: string;
  }> = (Object.values(EmploymentStatus) as EmploymentStatus[]).map((v) => ({
    value: v,
    label: EMPLOYMENT_STATUS_LABELS[v],
  }));

  /** Debounce timer del search. */
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit(): Promise<void> {
    /* Hidrata desde URL primero (compartibles + F5), luego del store
     * (back desde detail). El store gana si la URL no trae nada. */
    const qp = this.route.snapshot.queryParamMap;
    const urlSearch = qp.get('search');
    const urlStatus = this.parseStatus(qp.get('employmentStatus'));
    const urlHasAcc = this.parseBool(qp.get('hasUserAccount'));

    if (urlSearch || urlStatus || urlHasAcc !== null) {
      this.search.set(urlSearch ?? '');
      this.employmentStatus.set(urlStatus);
      this.hasUserAccount.set(urlHasAcc);
      await this.applyFilters();
    } else {
      const f = this.store.filters();
      this.search.set(f.search ?? '');
      this.employmentStatus.set(f.employmentStatus ?? null);
      this.hasUserAccount.set(f.hasUserAccount === undefined ? null : f.hasUserAccount);
      if (this.items().length === 0) {
        await this.store.loadList();
      }
    }
  }

  // ===========================================================================
  // Filters & pagination
  // ===========================================================================

  protected onSearchChange(value: string): void {
    this.search.set(value);
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.applyFilters(), 350);
  }

  protected onStatusChange(value: EmploymentStatus | null): void {
    this.employmentStatus.set(value);
    void this.applyFilters();
  }

  protected onAccountChange(value: boolean | null): void {
    this.hasUserAccount.set(value);
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
  // Helpers
  // ===========================================================================

  protected detailLink(publicUuid: string): string {
    return ROUTES.TEACHERS.detail(publicUuid);
  }

  private async applyFilters(): Promise<void> {
    const filters: TeacherListFilters = {
      search: this.search().trim() || undefined,
      employmentStatus: this.employmentStatus() ?? undefined,
      hasUserAccount: this.hasUserAccount() ?? undefined,
    };
    this.syncUrl(filters);
    await this.store.applyFilters(filters);
  }

  private syncUrl(filters: TeacherListFilters): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        search: filters.search ?? null,
        employmentStatus: filters.employmentStatus ?? null,
        hasUserAccount: filters.hasUserAccount ?? null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private parseStatus(value: string | null): EmploymentStatus | null {
    if (!value) return null;
    return (Object.values(EmploymentStatus) as string[]).includes(value)
      ? (value as EmploymentStatus)
      : null;
  }

  private parseBool(value: string | null): boolean | null {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
  }
}
