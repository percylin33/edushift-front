import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { Permission, UserRole } from '@core/enums';
import { AuthService, TenantService } from '@core/services';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
  StatCardComponent,
} from '@shared/components';
import { AttendanceRecentSession, AttendanceSessionSlot, AttendanceTopSection, TeacherDashboardSnapshot, TeacherMySession } from '../../models';
import { AnalyticsApiService, AnalyticsChartPoint, AnalyticsChartSeries, AnalyticsKpiEntry } from '../../services/analytics-api.service';
import { DashboardApiService } from '../../services/dashboard-api.service';
import { DashboardStore } from '../../store/dashboard.store';
import { AnalyticsTrendChartComponent } from '../../components/analytics-trend-chart';

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
    SpinnerComponent,
    AnalyticsTrendChartComponent,
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
      } @else if (isParent()) {
        <ng-container *ngTemplateOutlet="parentView" />
      } @else if (isStudent()) {
        <ng-container *ngTemplateOutlet="studentView" />
      } @else {
        <ng-container *ngTemplateOutlet="teacherView" />
      }

      <ng-template #parentView>
        <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <a routerLink="/family" class="card transition hover:ring-2 hover:ring-indigo-400">
            <div class="card-body">
              <h2 class="text-lg font-semibold">Mis hijos</h2>
              <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">Consulta su rendimiento, asistencia y actividades.</p>
              <span class="mt-4 inline-block text-sm font-semibold text-indigo-600">Ver información familiar →</span>
            </div>
          </a>
          <a routerLink="/payments" class="card transition hover:ring-2 hover:ring-emerald-400">
            <div class="card-body">
              <h2 class="text-lg font-semibold">Pagos pendientes</h2>
              <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">Revisa tus cuotas y estados de cuenta.</p>
              <span class="mt-4 inline-block text-sm font-semibold text-emerald-600">Ver pagos →</span>
            </div>
          </a>
          <a routerLink="/announcements" class="card transition hover:ring-2 hover:ring-amber-400">
            <div class="card-body">
              <h2 class="text-lg font-semibold">Comunicados del colegio</h2>
              <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">No te pierdas avisos importantes.</p>
              <span class="mt-4 inline-block text-sm font-semibold text-amber-600">Ver anuncios →</span>
            </div>
          </a>
        </section>
      </ng-template>

      <!-- ===================================================================
        Student view (DEBT-STUDENT-PRIVACY / Fase 1) — light dashboard
        surfacing the six sub-sections of the personal workspace.
        Each card is conditionally rendered based on the matching
        ME permission so a tenant that disables e.g. payments for
        K-6 segments sees a clean grid without broken links.
      ==================================================================== -->
      <ng-template #studentView>
        <section
          aria-label="Accesos rápidos de mi espacio"
          class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          @if (auth.hasPermission(Permission.MeRead)) {
            <a routerLink="/me/courses" class="card transition hover:ring-2 hover:ring-indigo-400">
              <div class="card-body">
                <h2 class="text-lg font-semibold">Mis cursos</h2>
                <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">Materiales, tareas y quizzes asignados.</p>
                <span class="mt-4 inline-block text-sm font-semibold text-indigo-600">Ver mis cursos →</span>
              </div>
            </a>
            <a routerLink="/me/grades" class="card transition hover:ring-2 hover:ring-indigo-400">
              <div class="card-body">
                <h2 class="text-lg font-semibold">Mis notas</h2>
                <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">Calificaciones por curso y periodo.</p>
                <span class="mt-4 inline-block text-sm font-semibold text-indigo-600">Ver mis notas →</span>
              </div>
            </a>
          }
          @if (auth.hasPermission(Permission.MeAttendanceRead)) {
            <a routerLink="/me/attendance" class="card transition hover:ring-2 hover:ring-emerald-400">
              <div class="card-body">
                <h2 class="text-lg font-semibold">Mi asistencia</h2>
                <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">Historial y justificaciones.</p>
                <span class="mt-4 inline-block text-sm font-semibold text-emerald-600">Ver mi asistencia →</span>
              </div>
            </a>
          }
          @if (auth.hasPermission(Permission.MeQrRead)) {
            <a routerLink="/me/qr" class="card transition hover:ring-2 hover:ring-indigo-400">
              <div class="card-body">
                <h2 class="text-lg font-semibold">Mi QR</h2>
                <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">Credencial imprimible de asistencia.</p>
                <span class="mt-4 inline-block text-sm font-semibold text-indigo-600">Ver mi QR →</span>
              </div>
            </a>
          }
          @if (auth.hasPermission(Permission.MePaymentsRead)) {
            <a routerLink="/me/payments" class="card transition hover:ring-2 hover:ring-emerald-400">
              <div class="card-body">
                <h2 class="text-lg font-semibold">Mis pagos</h2>
                <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">Cuotas, estados y comprobantes.</p>
                <span class="mt-4 inline-block text-sm font-semibold text-emerald-600">Ver mis pagos →</span>
              </div>
            </a>
          }
          <a routerLink="/announcements" class="card transition hover:ring-2 hover:ring-amber-400">
            <div class="card-body">
              <h2 class="text-lg font-semibold">Comunicados</h2>
              <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">Anuncios publicados para ti.</p>
              <span class="mt-4 inline-block text-sm font-semibold text-amber-600">Ver anuncios →</span>
            </div>
          </a>
        </section>
      </ng-template>

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

        <!-- =============================================================
          Sprint cierre-A / F10 — tenant KPI cards (analytics B1)
          Three high-level indicators alongside the existing attendance KPIs.
        ============================================================== -->
        <section
          aria-label="Indicadores (cierre-A / B1)"
          class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="analytics-kpi-section"
        >
          <div class="card">
            <div class="card-body">
              <p class="text-xs uppercase tracking-wide text-content-subtle">Asistencia</p>
              <p class="mt-1 text-3xl font-semibold tabular-nums text-content">
                {{ formatRate(attendanceKpi()?.value) }}
              </p>
              <p class="mt-1 text-xs text-content-muted">
                Últimos 30 días · ATTENDANCE_RATE
              </p>
            </div>
          </div>
          <div class="card">
            <div class="card-body">
              <p class="text-xs uppercase tracking-wide text-content-subtle">Rendimiento</p>
              <p class="mt-1 text-3xl font-semibold tabular-nums text-content">
                {{ formatRate(performanceKpi()?.value) }}
              </p>
              <p class="mt-1 text-xs text-content-muted">
                Últimos 30 días · PERFORMANCE_AVG
              </p>
            </div>
          </div>
          <div class="card">
            <div class="card-body">
              <p class="text-xs uppercase tracking-wide text-content-subtle">Morosidad</p>
              <p class="mt-1 text-3xl font-semibold tabular-nums text-content">
                {{ formatRate(morosidadKpi()?.value) }}
              </p>
              <p class="mt-1 text-xs text-content-muted">
                Últimos 30 días · MOROSIDAD
              </p>
            </div>
          </div>
        </section>

        <!-- =============================================================
          Sprint cierre-A / F10 — tenant trend charts
          Three line charts using ng2-charts, fed by the B1 chart endpoints.
        ============================================================== -->
        <section
          aria-label="Tendencia (últimos 30 días)"
          class="mt-6 grid gap-4 lg:grid-cols-3"
          data-testid="analytics-trend-section"
        >
          <app-analytics-trend-chart
            title="Tasa de asistencia"
            subtitle="ATTENDANCE_RATE — % del 0..1"
            [data]="analyticsAttendanceSeries()"
            color="#6366f1"
          />
          <app-analytics-trend-chart
            title="Rendimiento académico"
            subtitle="PERFORMANCE_AVG — normalizado 0..1"
            [data]="analyticsPerformanceSeries()"
            color="#10b981"
          />
          <app-analytics-trend-chart
            title="Morosidad"
            subtitle="% facturas vencidas vs. emitidas"
            [data]="analyticsMorosidadSeries()"
            color="#ef4444"
          />
        </section>

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
        Teacher view — Sprint 9B / FE-9B.1
        Real data: 4 KPIs + mySectionsToday + top-absent + recent-closed.
      ==================================================================== -->
      <ng-template #teacherView>
        @if (teacher(); as t) {
          @if (t.noActiveAssignments) {
            <div class="card">
              <div class="card-body">
                <app-empty-state
                  icon="users"
                  title="Sin asignaciones activas"
                  description="Cuando un administrador te asigne a una sección, verás aquí tus clases de hoy, los alumnos ausentes y tus sesiones recientes."
                />
              </div>
            </div>
          } @else {
            <section aria-label="Resumen de hoy" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              @for (kpi of teacherKpis(); track kpi.id) {
                <app-stat-card [label]="kpi.label" [value]="kpi.value" [icon]="kpi.icon" [delta]="kpi.delta" [trend]="kpi.trend" />
              }
            </section>

            <!-- Mis secciones hoy (top of the page — what needs attention NOW) -->
            @if (teacherMySections().length > 0) {
              <section aria-label="Mis secciones hoy" class="card">
                <header class="card-header flex items-center justify-between gap-2">
                  <div>
                    <h2 class="text-base font-semibold text-content">Mis secciones hoy</h2>
                    <p class="mt-0.5 text-xs text-content-muted">
                      Acciones pendientes: abrir sesiones que aún no has abierto o cerrar las que están activas.
                    </p>
                  </div>
                  @if (teacherLastUpdated(); as label) {
                    <span class="text-xs text-content-subtle">{{ label }}</span>
                  }
                </header>
                <ul class="divide-y divide-slate-200 dark:divide-slate-800" data-testid="teacher-my-sections">
                  @for (s of teacherMySections(); track s.sectionPublicUuid) {
                    <li
                      class="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                      [attr.data-testid]="'teacher-my-section-' + s.sectionPublicUuid"
                      [attr.data-status]="s.status"
                    >
                      <div class="min-w-0 flex-1">
                        <p class="truncate font-medium text-content">{{ sectionSectionLabel(s) }}</p>
                        <p class="mt-0.5 text-xs text-content-muted">
                          {{ slotLabel(s.slot) }} ·
                          {{ s.presentCount }}/{{ s.enrolledStudents }} confirmados ·
                          {{ s.absentCount }} ausentes
                        </p>
                      </div>
                      @if (teacherSessionLink(s); as link) {
                        <a
                          [routerLink]="link"
                          class="btn btn-primary btn-sm"
                        >
                          {{ teacherCtaLabel(s) }}
                        </a>
                      } @else {
                        <span class="text-xs text-content-subtle">Sin sesión abierta</span>
                      }
                    </li>
                  }
                </ul>
              </section>
            }

            <!-- Top absent (last 7 days) + recent closed -->
            @if (teacherTopSections().length > 0) {
              <section aria-label="Top secciones con mas inasistencias" class="card">
                <header class="card-header">
                  <h2 class="text-base font-semibold text-content">
                    Top secciones con mas inasistencias (ultimos 7 dias)
                  </h2>
                </header>
                <ul class="divide-y divide-slate-200 dark:divide-slate-800" data-testid="teacher-top-absent">
                  @for (s of teacherTopSections(); track s.sectionPublicUuid) {
                    <li
                      class="flex items-center justify-between gap-3 px-5 py-3"
                      [attr.data-testid]="'teacher-top-section-' + s.sectionPublicUuid"
                    >
                      <div class="min-w-0 flex-1">
                        <p class="truncate font-medium text-content">
                          {{ s.sectionName }}
                          @if (s.gradeName) {
                            <span class="ml-1 text-xs text-content-subtle">({{ s.gradeName }})</span>
                          }
                        </p>
                        <p class="mt-0.5 text-xs text-content-muted">
                          {{ s.absentCount }} de {{ s.enrolledStudents }} ({{ s.absentRatePct }}%)
                        </p>
                      </div>
                      <span [class]="rateBadgeClass(s.absentRatePct)">
                        {{ s.absentRatePct }}%
                      </span>
                    </li>
                  }
                </ul>
              </section>
            }

            @if (teacherRecentSessions().length > 0) {
              <section aria-label="Ultimas sesiones cerradas" class="card">
                <header class="card-header">
                  <h2 class="text-base font-semibold text-content">
                    Ultimas sesiones cerradas
                  </h2>
                </header>
                <ul class="divide-y divide-slate-200 dark:divide-slate-800" data-testid="teacher-recent-closed">
                  @for (s of teacherRecentSessions(); track s.sessionPublicUuid) {
                    <li
                      class="flex items-center justify-between gap-3 px-5 py-3"
                      [attr.data-testid]="'teacher-recent-session-' + s.sessionPublicUuid"
                    >
                      <div class="min-w-0 flex-1">
                        <p class="truncate font-medium text-content">{{ s.sectionName }}</p>
                        <p class="mt-0.5 text-xs text-content-muted">
                          {{ s.occurredOn | date: 'short' }} · {{ slotLabel(s.slot) }} ·
                          cerrado {{ s.closedAt | date: 'shortTime' }}
                        </p>
                      </div>
                      <a
                        [routerLink]="sessionLink(s.sessionPublicUuid)"
                        class="btn btn-secondary btn-sm"
                      >
                        Ver detalle
                      </a>
                    </li>
                  }
                </ul>
              </section>
            }
          }
        } @else {
          <div class="card" data-testid="teacher-loading">
            <div class="card-body flex items-center justify-center py-12">
              <app-spinner [size]="32" />
            </div>
          </div>
        }
      </ng-template>
    </app-page-container>
  `,
})
export class DashboardHomeComponent implements OnInit {
  private readonly tenant = inject(TenantService);
  protected readonly auth = inject(AuthService);
  private readonly api = inject(DashboardApiService);
  private readonly analyticsApi = inject(AnalyticsApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly store = inject(DashboardStore);

  /** Sprint 9B / FE-9B.1 — teacher snapshot signal. Hydrated by
   *  {@link loadTeacherDashboard} on init if the user is a TEACHER. */
  protected readonly teacherSnapshot = signal<TeacherDashboardSnapshot | null>(null);

  /** Sprint cierre-A / F10 — analytics chart series (30d window). */
  protected readonly analyticsKpis = signal<readonly AnalyticsKpiEntry[]>([]);
  protected readonly analyticsAttendanceSeries = signal<readonly AnalyticsChartPoint[]>([]);
  protected readonly analyticsPerformanceSeries = signal<readonly AnalyticsChartPoint[]>([]);
  protected readonly analyticsMorosidadSeries = signal<readonly AnalyticsChartPoint[]>([]);
  protected readonly analyticsLoading = signal(false);

  /** Convenience computed: ATTENDANCE_RATE value (or null if not loaded). */
  protected readonly attendanceKpi = computed<AnalyticsKpiEntry | null>(() => {
		const k = this.analyticsKpis().find((x) => x.metricKey === 'ATTENDANCE_RATE');
		return k ?? null;
	});

  /** Convenience computed: PERFORMANCE_AVG value (or null if not loaded). */
  protected readonly performanceKpi = computed<AnalyticsKpiEntry | null>(() => {
		const k = this.analyticsKpis().find((x) => x.metricKey === 'PERFORMANCE_AVG');
		return k ?? null;
	});

  /** Convenience computed: MOROSIDAD value (or null if not loaded). */
  protected readonly morosidadKpi = computed<AnalyticsKpiEntry | null>(() => {
		const k = this.analyticsKpis().find((x) => x.metricKey === 'MOROSIDAD');
		return k ?? null;
	});

  /** Formats a 0..1 KPI rate as a 0..100 percentage string. */
  protected formatRate(value: number | null | undefined): string {
		if (value == null || Number.isNaN(value)) return '—';
		return `${(value * 100).toFixed(1)}%`;
	}

  protected readonly isAdmin = computed(() => this.auth.hasRole(UserRole.TenantAdmin));
  protected readonly isTeacher = computed(() => this.auth.hasRole(UserRole.Teacher));
  protected readonly isParent = computed(() => this.auth.hasRole(UserRole.Parent));
  protected readonly isStudent = computed(() => this.auth.hasRole(UserRole.Student));
  protected readonly overview = this.store.overview;

  /** Re-exported so the template can reference {@link Permission.MeRead}
   *  etc. directly without having to alias the enum at the call site. */
  protected readonly Permission = Permission;

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
  // ==========================================================================
  // Sprint 9B / FE-9B.1 — Teacher dashboard computeds
  // ==========================================================================

  /** True while the teacher dashboard data is loading. */
  protected readonly teacherLoading = signal(false);

  /** Snapshot convenience for the template. */
  protected readonly teacher = computed<TeacherDashboardSnapshot | null>(
    () => this.teacherSnapshot(),
  );

  /** "Actualizado hace X" for the teacher header. */
  protected readonly teacherLastUpdated = computed(() => {
    const t = this.teacherSnapshot();
    if (!t) return null;
    return `Actualizado ${formatRelative(t.generatedAt)}`;
  });

  /** The four teacher KPIs in the same shape as the admin kpis. */
  protected readonly teacherKpis = computed(() => {
    const t = this.teacherSnapshot();
    if (!t) return EMPTY_KPIS;
    return [
      {
        id: 'rate',
        label: 'Tasa de asistencia hoy',
        value: t.enrollmentsConsidered === 0
          ? '—'
          : `${t.attendanceRateToday.toFixed(1)}%`,
        icon: 'calendar-check' as const,
        delta:
          t.enrollmentsConsidered === 0
            ? 'Sin clase hoy'
            : `${t.enrollmentsConsidered} matriculados considerados`,
        trend: 'flat' as const,
      },
      {
        id: 'open',
        label: 'Sesiones abiertas',
        value: t.openSessions.toString(),
        icon: 'clock' as const,
        delta: null,
        trend: 'flat' as const,
      },
      {
        id: 'unique',
        label: 'Estudiantes registrados hoy',
        value: t.uniqueStudentsRegisteredToday.toString(),
        icon: 'users' as const,
        delta: null,
        trend: 'flat' as const,
      },
      {
        id: 'absent',
        label: 'Inasistencias hoy',
        value: t.totalAbsencesToday.toString(),
        icon: 'alert-circle' as const,
        delta: null,
        trend: 'flat' as const,
      },
    ];
  });

  /** Top-absent sections (teacher-scoped). */
  protected readonly teacherTopSections = computed<readonly AttendanceTopSection[]>(
    () => this.teacherSnapshot()?.topAbsentSections ?? [],
  );

  /** Recent closed sessions (teacher-scoped). */
  protected readonly teacherRecentSessions = computed<readonly AttendanceRecentSession[]>(
    () => this.teacherSnapshot()?.recentClosedSessions ?? [],
  );

  /** Sections the teacher needs to attend to today. */
  protected readonly teacherMySections = computed<readonly TeacherMySession[]>(
    () => this.teacherSnapshot()?.mySectionsToday ?? [],
  );

  /** Session-detail link for the "Mis secciones" card. */
  protected teacherSessionLink(s: TeacherMySession): string | null {
    return s.sessionPublicUuid
      ? ROUTES.ATTENDANCE.session(s.sessionPublicUuid)
      : null;
  }

  /** CTAs in the "Mis secciones" card depending on status. */
  protected teacherCtaLabel(s: TeacherMySession): string {
    switch (s.status) {
      case 'PENDING':
        return 'Abrir sesión';
      case 'ACTIVE':
        return 'Cerrar sesión';
      case 'CLOSED':
      default:
        return 'Ver sesión';
    }
  }

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
      label: 'Entrada / Escáner',
      icon: 'qr-code',
      route: ROUTES.ATTENDANCE.SCANNER,
      description: 'Asistencia en la puerta: QR o búsqueda, sin elegir sección.',
    },
    {
      id: 'sessions',
      label: 'Sesiones de hoy',
      icon: 'calendar-check',
      route: ROUTES.ATTENDANCE.SESSIONS,
      description: 'Revisión por sección/aula y abrir sesión manual.',
    },
    {
      id: 'rubrics',
      label: 'Rúbricas',
      icon: 'layers',
      route: ROUTES.RUBRICS.ROOT,
      description: 'Catálogo de rúbricas para tus registros.',
    },
  ];

  ngOnInit(): void {
    if (this.isAdmin()) {
      this.store.loadAttendanceOverview();
    } else if (this.isTeacher()) {
      this.loadTeacherDashboard();
    }
    if (this.isParent()) {
      return;
    }
    // Sprint cierre-A / F10: load analytics for both admin and teacher
    // views (the BE endpoint permits TENANT_ADMIN + TEACHER + STUDENT).
    this.loadAnalytics();
  }

  protected refresh(): void {
    if (this.isAdmin()) {
      this.store.loadAttendanceOverview();
    } else if (this.isTeacher()) {
      this.loadTeacherDashboard();
    }
    this.loadAnalytics();
  }

  /**
   * Sprint cierre-A / F10: fetch the current KPI summary + the 30-day
   * attendance / performance / morosidad trend series. Failures are
   * silent (the section shows empty states); the rest of the dashboard
   * keeps working.
   */
  private loadAnalytics(): void {
    this.analyticsLoading.set(true);
    const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const to = new Date().toISOString();

    this.analyticsApi.getKpis().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (s) => this.analyticsKpis.set(s.kpis),
      error: () => this.analyticsKpis.set([]),
    });
    this.analyticsApi.getAttendanceSeries(from, to).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (s) => this.analyticsAttendanceSeries.set(s.points),
      error: () => this.analyticsAttendanceSeries.set([]),
    });
    this.analyticsApi.getPerformanceSeries(from, to).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (s) => this.analyticsPerformanceSeries.set(s.points),
      error: () => this.analyticsPerformanceSeries.set([]),
    });
    this.analyticsApi.getMorosidadSeries(from, to).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (s) => this.analyticsMorosidadSeries.set(s.points),
      error: () => this.analyticsMorosidadSeries.set([]),
      complete: () => this.analyticsLoading.set(false),
    });
  }

  /** Sprint 9B / FE-9B.1 — fetch the teacher-scoped snapshot. */
  private loadTeacherDashboard(): void {
    this.api
      .getTeacherDashboard()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (snap) => this.teacherSnapshot.set(snap),
        error: () => this.teacherSnapshot.set(null),
      });
  }

  protected slotLabel(slot: AttendanceSessionSlot): string {
    return SLOT_LABEL[slot];
  }

  /** Grado + sección (ej. {@code 1ro Primaria · A}). */
  protected sectionSectionLabel(s: TeacherMySession): string {
    return s.gradeName ? `${s.gradeName} · ${s.sectionName}` : s.sectionName;
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
