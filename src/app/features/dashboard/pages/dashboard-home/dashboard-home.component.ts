import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { UserRole } from '@core/enums';
import { AuthService, TenantService } from '@core/services';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  StatCardComponent,
} from '@shared/components';
import { AttendanceRecentSession, AttendanceSessionSlot, AttendanceTopSection } from '../../models';
import { DashboardStore } from '../../store/dashboard.store';

interface QuickLink {
  readonly id: string;
  readonly label: string;
  readonly icon: 'calendar-check' | 'qr-code' | 'layers';
  readonly route: string;
  readonly description: string;
}

const SLOT_LABEL: Record<AttendanceSessionSlot, string> = {
  MORNING: 'Mañana',
  AFTERNOON: 'Tarde',
  EVENING: 'Noche',
};

/**
 * Landing page of the authenticated app (FE-6.4).
 *
 * <p>The component is role-aware:
 * <ul>
 *   <li><b>TENANT_ADMIN</b> sees the real attendance dashboard:
 *       4 KPI cards (today rate / open sessions / unique students /
 *       total absences), the "top absent sections" table for the
 *       last 7 days, and the "last 5 closed sessions" list.</li>
 *   <li><b>TEACHER</b> sees a lightweight welcome with quick-access
 *       cards to scanner, sessions and students. The admin-only
 *       endpoint is never called from this branch — that's why the
 *       page is reachable without a {@code roleGuard}.</li>
 * </ul>
 *
 * <p>Snapshot is fetched on init; the user can re-trigger it with the
 * "Actualizar" button (no auto-refresh on a timer for now — keeps the
 * implementation simple; the {@code generatedAt} stamp tells how
 * fresh the numbers are and the user has explicit control).
 */
@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    NgTemplateOutlet,
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    StatCardComponent,
    EmptyStateComponent,
    IconComponent,
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header [title]="greeting()" [subtitle]="subtitle()" eyebrow="Resumen">
        @if (isAdmin()) {
          <button
            type="button"
            class="btn btn-outline btn-sm"
            (click)="refresh()"
            [disabled]="store.loading()"
          >
            <app-icon name="rotate-cw" [size]="16" />
            <span class="hidden sm:inline">
              {{ store.loading() ? 'Actualizando…' : 'Actualizar' }}
            </span>
          </button>
        }
      </app-page-header>

      @if (isAdmin()) {
        <ng-container *ngTemplateOutlet="adminView" />
      } @else {
        <ng-container *ngTemplateOutlet="teacherView" />
      }

      <!-- ===================================================================
        Admin view — KPIs + top absent + recent closed
      ==================================================================== -->
      <ng-template #adminView>
        @if (store.error(); as err) {
          <div role="alert" class="card mb-6 border-l-4 border-l-danger bg-danger/5">
            <div class="card-body flex items-start gap-3">
              <app-icon name="alert-circle" [size]="20" class="mt-0.5 shrink-0 text-danger" />
              <div class="flex-1">
                <p class="font-medium text-danger">No se pudo cargar el resumen</p>
                <p class="mt-1 text-sm text-content-muted">{{ err }}</p>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                (click)="refresh()"
                [disabled]="store.loading()"
              >
                Reintentar
              </button>
            </div>
          </div>
        }

        <section
          aria-label="KPIs del día"
          class="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4"
        >
          @for (kpi of kpis(); track kpi.id) {
            <app-stat-card
              [label]="kpi.label"
              [value]="kpi.value"
              [icon]="kpi.icon"
              [delta]="kpi.delta"
              [trend]="kpi.trend"
            />
          }
        </section>

        @if (lastUpdatedLabel(); as stamp) {
          <p class="mt-3 text-xs text-content-subtle">{{ stamp }}</p>
        }

        <section class="mt-8 grid gap-6 lg:grid-cols-3">
          <!-- Top absent (7d) -->
          <div class="card lg:col-span-2">
            <div class="card-header">
              <div>
                <h2 class="card-title">Top secciones con más inasistencias</h2>
                <p class="card-description">
                  Últimos 7 días — ranking por inasistencias acumuladas.
                </p>
              </div>
            </div>
            <div class="card-body p-0">
              @if (store.loading() && !overview()) {
                <div class="flex items-center justify-center py-12 text-content-muted">
                  <app-icon name="rotate-cw" [size]="20" class="mr-2 animate-spin" />
                  <span class="text-sm">Cargando ranking…</span>
                </div>
              } @else if (topSections().length === 0) {
                <app-empty-state
                  icon="layout-grid"
                  title="Sin inasistencias en los últimos 7 días"
                  description="Cuando se registren inasistencias, las secciones aparecerán aquí."
                />
              } @else {
                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead>
                      <tr
                        class="border-b border-border text-left text-xs uppercase tracking-wide text-content-subtle"
                      >
                        <th class="px-4 py-3 font-medium">Sección</th>
                        <th class="px-4 py-3 font-medium">Grado</th>
                        <th class="px-4 py-3 text-right font-medium">Inasistencias</th>
                        <th class="px-4 py-3 text-right font-medium">Matriculados</th>
                        <th class="px-4 py-3 text-right font-medium">% inasistencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of topSections(); track row.sectionPublicUuid) {
                        <tr
                          class="border-b border-border last:border-b-0 hover:bg-surface-muted/50"
                        >
                          <td class="px-4 py-3 font-medium text-content">{{ row.sectionName }}</td>
                          <td class="px-4 py-3 text-content-muted">{{ row.gradeName ?? '—' }}</td>
                          <td class="px-4 py-3 text-right font-semibold tabular-nums text-danger">
                            {{ row.absentCount }}
                          </td>
                          <td class="px-4 py-3 text-right tabular-nums text-content-muted">
                            {{ row.enrolledStudents }}
                          </td>
                          <td class="px-4 py-3 text-right tabular-nums">
                            <span [class]="rateBadgeClass(row.absentRatePct)">
                              {{ row.absentRatePct }}%
                            </span>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>

          <!-- Recent closed sessions -->
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">Últimas sesiones cerradas</h2>
              <p class="card-description">Las 5 más recientes.</p>
            </div>
            <div class="card-body p-0">
              @if (store.loading() && !overview()) {
                <div class="flex items-center justify-center py-12 text-content-muted">
                  <app-icon name="rotate-cw" [size]="20" class="mr-2 animate-spin" />
                  <span class="text-sm">Cargando…</span>
                </div>
              } @else if (recentSessions().length === 0) {
                <app-empty-state
                  icon="calendar-check"
                  title="Aún no hay sesiones cerradas"
                  description="Las sesiones que cierren los docentes aparecerán aquí."
                />
              } @else {
                <ul class="divide-y divide-border">
                  @for (s of recentSessions(); track s.sessionPublicUuid) {
                    <li>
                      <a
                        [routerLink]="sessionLink(s.sessionPublicUuid)"
                        class="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
                      >
                        <span
                          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-500/10 text-primary-700 dark:text-primary-300"
                        >
                          <app-icon name="calendar-check" [size]="16" />
                        </span>
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm font-medium text-content">
                            {{ s.sectionName }} · {{ slotLabel(s.slot) }}
                          </p>
                          <p class="mt-0.5 truncate text-xs text-content-muted">
                            <span class="text-success">{{ s.presentCount }} P</span>
                            <span class="mx-1 text-content-subtle">·</span>
                            <span class="text-warning">{{ s.lateCount }} T</span>
                            <span class="mx-1 text-content-subtle">·</span>
                            <span class="text-danger">{{ s.absentCount }} A</span>
                            <span class="mx-1 text-content-subtle">·</span>
                            <span>{{ s.excusedCount }} E</span>
                          </p>
                          <p class="mt-0.5 text-xs text-content-subtle">
                            Cerrada {{ s.closedAt | date: 'short' }}
                          </p>
                        </div>
                        <app-icon
                          name="chevron-right"
                          [size]="14"
                          class="mt-1.5 text-content-subtle"
                        />
                      </a>
                    </li>
                  }
                </ul>
              }
            </div>
          </div>
        </section>
      </ng-template>

      <!-- ===================================================================
        Teacher view — quick links only (no admin endpoint call)
      ==================================================================== -->
      <ng-template #teacherView>
        <section aria-label="Accesos rápidos" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (link of teacherLinks; track link.id) {
            <a
              [routerLink]="link.route"
              class="card group transition-shadow hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
            >
              <div class="card-body flex items-start gap-4">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-700 dark:text-primary-300"
                >
                  <app-icon [name]="link.icon" [size]="20" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="font-medium text-content">{{ link.label }}</p>
                  <p class="mt-1 text-xs text-content-muted">{{ link.description }}</p>
                </div>
                <app-icon
                  name="chevron-right"
                  [size]="14"
                  class="mt-1 text-content-subtle transition-transform group-hover:translate-x-0.5"
                />
              </div>
            </a>
          }
        </section>
      </ng-template>
    </app-page-container>
  `,
})
export class DashboardHomeComponent implements OnInit {
  private readonly tenant = inject(TenantService);
  private readonly auth = inject(AuthService);
  protected readonly store = inject(DashboardStore);

  protected readonly isAdmin = computed(() => this.auth.hasRole(UserRole.TenantAdmin));
  protected readonly overview = this.store.overview;

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const name = this.auth.user()?.firstName;
    const prefix = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
    return name ? `${prefix}, ${name}` : prefix;
  });

  protected readonly subtitle = computed(() => {
    const tenantName = this.tenant.tenant()?.name;
    return tenantName ? `Resumen general de ${tenantName}.` : 'Resumen general del tenant.';
  });

  /**
   * Four KPI tiles for the admin view. The shape mirrors what the
   * stat-card component expects so the template stays declarative.
   * `delta` is intentionally `null` for now: trend deltas (+x% vs
   * yesterday) require a second snapshot the dashboard endpoint does
   * not return, and stamping a fake one would mislead.
   */
  protected readonly kpis = computed(() => {
    const o = this.overview();
    if (!o) {
      return EMPTY_KPIS;
    }
    return [
      {
        id: 'rate',
        label: 'Tasa de asistencia hoy',
        value: o.noClassToday ? '—' : `${o.attendanceRateToday.toFixed(1)}%`,
        icon: 'calendar-check' as const,
        delta: o.noClassToday
          ? 'Sin clase hoy'
          : `${o.enrollmentsConsidered} matriculados considerados`,
        trend: 'flat' as const,
      },
      {
        id: 'open',
        label: 'Sesiones abiertas',
        value: o.openSessions.toString(),
        icon: 'clock' as const,
        delta: null,
        trend: 'flat' as const,
      },
      {
        id: 'unique',
        label: 'Estudiantes registrados hoy',
        value: o.uniqueStudentsRegisteredToday.toString(),
        icon: 'users' as const,
        delta: null,
        trend: 'flat' as const,
      },
      {
        id: 'absent',
        label: 'Inasistencias hoy',
        value: o.totalAbsencesToday.toString(),
        icon: 'alert-circle' as const,
        delta: null,
        trend: 'flat' as const,
      },
    ];
  });

  protected readonly topSections = computed<readonly AttendanceTopSection[]>(
    () => this.overview()?.topAbsentSections ?? [],
  );

  protected readonly recentSessions = computed<readonly AttendanceRecentSession[]>(
    () => this.overview()?.recentClosedSessions ?? [],
  );

  protected readonly lastUpdatedLabel = computed(() => {
    const o = this.overview();
    if (!o) return null;
    return `Actualizado ${formatRelative(o.generatedAt)}`;
  });

  /**
   * Curated quick-links for the teacher view. Every entry must be
   * reachable by the {@link UserRole.Teacher} role — `Estudiantes` is
   * intentionally omitted because the students module is currently
   * role-gated to {@link UserRole.TenantAdmin} only (see
   * `students.routes.ts` + sidebar config).
   */
  protected readonly teacherLinks: readonly QuickLink[] = [
    {
      id: 'scanner',
      label: 'Escáner QR',
      icon: 'qr-code',
      route: ROUTES.ATTENDANCE.SCANNER,
      description: 'Toma asistencia escaneando el QR del alumno.',
    },
    {
      id: 'sessions',
      label: 'Sesiones de hoy',
      icon: 'calendar-check',
      route: ROUTES.ATTENDANCE.SESSIONS,
      description: 'Abre, cierra o consulta tus sesiones del día.',
    },
    {
      id: 'rubrics',
      label: 'Rúbricas',
      icon: 'layers',
      route: ROUTES.RUBRICS.ROOT,
      description: 'Catálogo de rúbricas para tus evaluaciones.',
    },
  ];

  ngOnInit(): void {
    if (this.isAdmin()) {
      this.store.loadAttendanceOverview();
    }
  }

  protected refresh(): void {
    if (this.isAdmin()) {
      this.store.loadAttendanceOverview();
    }
  }

  protected slotLabel(slot: AttendanceSessionSlot): string {
    return SLOT_LABEL[slot];
  }

  protected sessionLink(sessionPublicUuid: string): string {
    return ROUTES.ATTENDANCE.session(sessionPublicUuid);
  }

  /**
   * Color-codes the absent rate so the eye lands on the worst sections
   * first. Thresholds are intentional and match the convention used
   * elsewhere in the attendance module:
   * <ul>
   *   <li>{@code &gt;= 30%} → danger</li>
   *   <li>{@code &gt;= 15%} → warning</li>
   *   <li>otherwise → success</li>
   * </ul>
   */
  protected rateBadgeClass(rate: number): string {
    const base =
      'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums';
    if (rate >= 30) return `${base} bg-danger/10 text-danger`;
    if (rate >= 15) return `${base} bg-warning/10 text-warning`;
    return `${base} bg-success/10 text-success`;
  }
}

const EMPTY_KPIS = [
  {
    id: 'rate',
    label: 'Tasa de asistencia hoy',
    value: '—',
    icon: 'calendar-check' as const,
    delta: null as string | null,
    trend: 'flat' as const,
  },
  {
    id: 'open',
    label: 'Sesiones abiertas',
    value: '—',
    icon: 'clock' as const,
    delta: null as string | null,
    trend: 'flat' as const,
  },
  {
    id: 'unique',
    label: 'Estudiantes registrados hoy',
    value: '—',
    icon: 'users' as const,
    delta: null as string | null,
    trend: 'flat' as const,
  },
  {
    id: 'absent',
    label: 'Inasistencias hoy',
    value: '—',
    icon: 'alert-circle' as const,
    delta: null as string | null,
    trend: 'flat' as const,
  },
];

/**
 * "Actualizado hace 3s / hace 2 min / hace 1 h" formatter.
 * Avoids pulling a heavy date library; the granularity is good
 * enough for a snapshot stamp.
 */
function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const sec = Math.max(1, Math.round(diffMs / 1000));
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  return date.toLocaleString();
}
