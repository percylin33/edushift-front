import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  StatCardComponent
} from '@shared/components';
import { TenantService } from '@core/services';

interface DashboardStat {
  id: string;
  label: string;
  value: string;
  icon: 'users' | 'book-open' | 'calendar-check' | 'credit-card';
  delta: string;
  trend: 'up' | 'down' | 'flat';
}

/**
 * Landing page of the authenticated app. Demonstrates the responsive layout
 * primitives:
 *
 *   - `PageContainer` for consistent gutters + max-width.
 *   - `PageHeader`    for title + actions.
 *   - `StatCard` grid: 1 col mobile · 2 col sm · 4 col lg.
 *   - Two-column information layout from `lg` upwards (recent + quick actions),
 *     stacked vertically below it.
 *
 * Values are static placeholders; once the dashboard feature has its own data
 * layer they will come from a store/signal.
 */
@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageContainerComponent,
    PageHeaderComponent,
    StatCardComponent,
    EmptyStateComponent,
    IconComponent
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header
        [title]="greeting()"
        [subtitle]="subtitle()"
        eyebrow="Resumen"
      >
        <button type="button" class="btn btn-outline btn-sm">
          <app-icon name="calendar-check" [size]="16" />
          <span class="hidden sm:inline">Hoy</span>
        </button>
        <button type="button" class="btn btn-primary btn-sm">
          <app-icon name="sparkles" [size]="16" />
          <span class="hidden sm:inline">Generar reporte</span>
        </button>
      </app-page-header>

      <section
        aria-label="Métricas clave"
        class="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4"
      >
        @for (stat of stats; track stat.id) {
          <app-stat-card
            [label]="stat.label"
            [value]="stat.value"
            [icon]="stat.icon"
            [delta]="stat.delta"
            [trend]="stat.trend"
          />
        }
      </section>

      <section class="mt-8 grid gap-6 lg:grid-cols-3">
        <div class="card lg:col-span-2">
          <div class="card-header">
            <div>
              <h2 class="card-title">Actividad reciente</h2>
              <p class="card-description">Eventos del tenant en las últimas 24h.</p>
            </div>
            <button type="button" class="btn btn-ghost btn-sm">Ver todo</button>
          </div>
          <div class="card-body">
            <app-empty-state
              icon="layout-grid"
              title="Sin actividad todavía"
              description="Cuando empiecen a llegar eventos los verás aquí."
            />
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Accesos rápidos</h2>
          </div>
          <div class="card-body grid gap-2">
            @for (link of quickLinks; track link.label) {
              <button
                type="button"
                class="flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm
                       hover:bg-surface-muted focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-primary-500/30"
              >
                <span
                  class="flex h-8 w-8 items-center justify-center rounded-md
                         bg-primary-500/10 text-primary-700 dark:text-primary-300"
                >
                  <app-icon [name]="link.icon" [size]="16" />
                </span>
                <span class="flex-1 truncate">{{ link.label }}</span>
                <app-icon name="chevron-right" [size]="14" class="text-content-subtle" />
              </button>
            }
          </div>
        </div>
      </section>
    </app-page-container>
  `
})
export class DashboardHomeComponent {
  private readonly tenant = inject(TenantService);

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  });

  readonly subtitle = computed(() => {
    const name = this.tenant.tenant()?.name;
    return name ? `Resumen general de ${name}.` : 'Resumen general del tenant.';
  });

  readonly stats: readonly DashboardStat[] = [
    { id: 'students', label: 'Estudiantes', value: '1,284', icon: 'users', delta: '+12 esta semana', trend: 'up' },
    { id: 'courses', label: 'Cursos activos', value: '46', icon: 'book-open', delta: 'sin cambios', trend: 'flat' },
    { id: 'attendance', label: 'Asistencia hoy', value: '92%', icon: 'calendar-check', delta: '+3% vs ayer', trend: 'up' },
    { id: 'payments', label: 'Pagos pendientes', value: '$ 12,450', icon: 'credit-card', delta: '-4% vs mes anterior', trend: 'down' }
  ];

  readonly quickLinks: readonly { label: string; icon: 'users' | 'book-open' | 'calendar-check' | 'credit-card' | 'sparkles' }[] = [
    { label: 'Nuevo estudiante', icon: 'users' },
    { label: 'Tomar asistencia', icon: 'calendar-check' },
    { label: 'Registrar pago', icon: 'credit-card' },
    { label: 'Crear reporte con IA', icon: 'sparkles' }
  ];
}
