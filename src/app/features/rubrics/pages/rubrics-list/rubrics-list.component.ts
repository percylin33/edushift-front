import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ROUTES } from '@core/constants';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import { RubricCardComponent, ForkRubricModalComponent } from '../../components';
import { RubricsStore } from '../../store';
import { RubricFilters, RubricRow } from '../../models';

/**
 * `/rubrics` — Listado de rúbricas con filtros (system / personalizadas /
 * texto) URL-synced y banner "Cargar MINEDU" cuando el tenant aún no
 * ha sembrado el catálogo (FE-5B.2).
 */
@Component({
  selector: 'app-rubrics-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    EmptyStateComponent,
    IconComponent,
    PageContainerComponent,
    PageHeaderComponent,
    SpinnerComponent,
    RubricCardComponent,
    ForkRubricModalComponent,
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header
        eyebrow="Evaluación"
        title="Rúbricas"
        subtitle="Plantillas de criterios y niveles para calificar de forma cualitativa."
      >
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          [disabled]="loading() || hasSystemRubrics()"
          (click)="loadSystem()"
        >
          <app-icon name="download" [size]="16" />
          <span>{{ hasSystemRubrics() ? 'MINEDU cargadas' : 'Cargar MINEDU' }}</span>
        </button>
        <button type="button" class="btn btn-primary btn-sm" (click)="goToCreate()">
          <app-icon name="plus" [size]="16" />
          <span>Nueva rúbrica</span>
        </button>
      </app-page-header>

      @if (!hasSystemRubrics() && rows().length === 0 && !loading()) {
        <section class="alert alert-info mb-4">
          <app-icon name="info" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">¿Empezamos con las plantillas MINEDU?</p>
            <p class="mt-1 text-sm opacity-80">
              Cargamos automáticamente las 4 rúbricas oficiales (lectura, escritura, matemática,
              competencias generales) que puedes forkear y adaptar a tu contexto.
            </p>
          </div>
          <button type="button" class="btn btn-primary btn-sm" (click)="loadSystem()">
            <app-icon name="download" [size]="16" />
            <span>Cargar MINEDU</span>
          </button>
        </section>
      }

      <!-- Filtros -->
      <section class="card mb-4">
        <div class="card-body grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="field">
            <label class="label">Tipo</label>
            <select
              class="input"
              [value]="systemFilterValue()"
              (change)="onSystemChange($any($event.target).value)"
            >
              <option value="all">Todas</option>
              <option value="system">MINEDU</option>
              <option value="user">Personalizadas</option>
            </select>
          </div>

          <div class="field">
            <label class="label">Estado</label>
            <select
              class="input"
              [value]="filters().isActive === false ? 'inactive' : 'active'"
              (change)="onActiveChange($any($event.target).value)"
            >
              <option value="active">Activas</option>
              <option value="inactive">Inactivas</option>
            </select>
          </div>

          <div class="field sm:col-span-2 lg:col-span-1">
            <label class="label">Buscar</label>
            <input
              type="text"
              class="input"
              [value]="filters().q ?? ''"
              (input)="onSearchChange($any($event.target).value)"
              placeholder="Nombre o descripción…"
            />
          </div>

          <div class="flex items-end">
            <button type="button" class="btn btn-ghost btn-sm w-full" (click)="clearFilters()">
              <app-icon name="x" [size]="14" />
              <span>Limpiar</span>
            </button>
          </div>
        </div>
      </section>

      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando rúbricas…" />
        </div>
      } @else if (errorBanner()) {
        <div class="alert alert-danger">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">No pudimos cargar las rúbricas.</p>
            <p class="mt-1 text-xs opacity-80">{{ errorBanner() }}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" (click)="reload()">Reintentar</button>
        </div>
      } @else if (rows().length === 0) {
        <app-empty-state
          icon="layers"
          title="Aún no hay rúbricas"
          description="Crea tu primera rúbrica desde cero o carga el catálogo MINEDU para tener una base lista para forkear."
        >
          <button type="button" class="btn btn-primary btn-sm" (click)="goToCreate()">
            <app-icon name="plus" [size]="16" />
            <span>Nueva rúbrica</span>
          </button>
        </app-empty-state>
      } @else {
        <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          @for (row of rows(); track row.publicUuid) {
            <app-rubric-card
              [rubric]="row"
              (view)="goToDetail($event)"
              (edit)="goToEdit($event)"
              (fork)="openFork(row)"
              (remove)="onDelete(row)"
            />
          }
        </section>
      }
    </app-page-container>

    @if (forkOrigin(); as origin) {
      <app-fork-rubric-modal [origin]="origin" (closed)="closeFork()" (forked)="onForked($event)" />
    }
  `,
})
export class RubricsListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(RubricsStore);

  protected readonly rows = this.store.rows;
  protected readonly filters = this.store.filters;
  protected readonly loading = this.store.loading;
  protected readonly errorBanner = this.store.error;
  protected readonly hasSystemRubrics = this.store.hasSystemRubrics;

  protected readonly forkOrigin = signal<RubricRow | null>(null);

  protected readonly systemFilterValue = computed(() => {
    const f = this.filters().systemOnly;
    if (f === true) return 'system';
    if (f === false) return 'user';
    return 'all';
  });

  private debounceTimer: number | null = null;

  async ngOnInit(): Promise<void> {
    const filters = this.parseFiltersFromUrl();
    await this.store.load(filters);
  }

  // ===========================================================================
  // Filters
  // ===========================================================================

  protected async onSystemChange(value: string): Promise<void> {
    const next: RubricFilters = {
      ...this.filters(),
      systemOnly: value === 'all' ? undefined : value === 'system',
    };
    this.syncUrl(next);
    await this.store.setFilters(next);
  }

  protected async onActiveChange(value: string): Promise<void> {
    const next: RubricFilters = {
      ...this.filters(),
      isActive: value === 'inactive' ? false : true,
    };
    this.syncUrl(next);
    await this.store.setFilters(next);
  }

  protected onSearchChange(value: string): void {
    if (this.debounceTimer) window.clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => {
      const next: RubricFilters = {
        ...this.filters(),
        q: value?.trim() || undefined,
      };
      this.syncUrl(next);
      void this.store.setFilters(next);
    }, 300);
  }

  protected async clearFilters(): Promise<void> {
    this.syncUrl({});
    await this.store.clearFilters();
  }

  // ===========================================================================
  // Actions
  // ===========================================================================

  protected async reload(): Promise<void> {
    this.store.clearError();
    await this.store.load(this.filters());
  }

  protected async loadSystem(): Promise<void> {
    await this.store.loadSystemRubrics();
  }

  protected goToCreate(): void {
    void this.router.navigate([ROUTES.RUBRICS.NEW]);
  }

  protected goToDetail(publicUuid: string): void {
    void this.router.navigate([ROUTES.RUBRICS.detail(publicUuid)]);
  }

  protected goToEdit(publicUuid: string): void {
    void this.router.navigate([ROUTES.RUBRICS.edit(publicUuid)]);
  }

  protected openFork(origin: RubricRow): void {
    this.store.clearError();
    this.forkOrigin.set(origin);
  }

  protected closeFork(): void {
    this.forkOrigin.set(null);
  }

  protected onForked(publicUuid: string): void {
    this.forkOrigin.set(null);
    void this.router.navigate([ROUTES.RUBRICS.edit(publicUuid)]);
  }

  protected async onDelete(row: RubricRow): Promise<void> {
    if (row.isSystem) return;
    const ok = confirm(
      `¿Eliminar la rúbrica "${row.name}"?\n\n` +
        'Si está vinculada a una evaluación, el servidor lo rechazará con\n' +
        '"RUB_IN_USE". Las inactivas se mantienen para reportes históricos.',
    );
    if (!ok) return;
    await this.store.remove(row.publicUuid);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private parseFiltersFromUrl(): RubricFilters {
    const qp = this.route.snapshot.queryParamMap;
    const sys = qp.get('systemOnly');
    const active = qp.get('isActive');
    return {
      systemOnly: sys === null ? undefined : sys === 'true',
      isActive: active === null ? undefined : active === 'true',
      q: qp.get('q') ?? undefined,
    };
  }

  private syncUrl(filters: RubricFilters): void {
    const cleanParams: Record<string, string> = {};
    if (filters.systemOnly !== undefined) {
      cleanParams['systemOnly'] = String(filters.systemOnly);
    }
    if (filters.isActive !== undefined) {
      cleanParams['isActive'] = String(filters.isActive);
    }
    if (filters.q) cleanParams['q'] = filters.q;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: cleanParams,
      queryParamsHandling: '',
      replaceUrl: true,
    });
  }
}
