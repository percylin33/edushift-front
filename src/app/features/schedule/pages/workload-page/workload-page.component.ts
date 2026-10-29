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
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import {
  EmptyStateComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import { AcademicApiService } from '@features/academic/services';
import {
  AcademicPeriodRow,
  AcademicYearRow,
  AcademicYearStatus,
  TeacherWorkloadItem,
} from '@features/academic/models';
import { ScheduleApiService } from '../../services/schedule-api.service';
import { ScheduleAdminNavComponent } from '../../components/schedule-admin-nav.component';
import {
  schedulePeriodLabel,
  selectSchedulePeriod,
  selectScheduleYear,
} from '../../utils/schedule-context.util';

type WorkloadSortKey = 'name' | 'minutes' | 'hours' | 'slots' | 'sections' | 'courses';

/**
 * Admin table of teacher weekly workload (minutes / slots / sections / courses).
 */
@Component({
  selector: 'app-workload-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    EmptyStateComponent,
    SpinnerComponent,
    ScheduleAdminNavComponent,
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header
        eyebrow="Horarios"
        title="Carga horaria docente"
        subtitle="Compara las horas asignadas y abre el horario de cada docente."
      />

      <app-schedule-admin-nav
        [active]="'workload'"
        [yearUuid]="selectedYearUuid()"
        [periodUuid]="selectedPeriodId()"
      />

      <section class="card mb-6">
        <div class="card-body grid gap-4 sm:grid-cols-12">
          <div class="sm:col-span-4">
            <label class="label" for="wl-year">Año académico</label>
            <select
              id="wl-year"
              class="select"
              [ngModel]="selectedYearUuid()"
              (ngModelChange)="onYearChange($event)"
            >
              <option value="">Seleccionar año…</option>
              @for (y of years(); track y.publicUuid) {
                <option [value]="y.publicUuid">{{ y.name }}{{ isActiveYear(y) ? ' · Vigente' : '' }}</option>
              }
            </select>
          </div>
          <div class="sm:col-span-4">
            <label class="label" for="wl-period">Periodo</label>
            <select
              id="wl-period"
              class="select"
              [ngModel]="selectedPeriodId()"
              (ngModelChange)="onPeriodChange($event)"
              [disabled]="!selectedYearUuid() || periods().length === 0"
            >
              <option value="">Seleccionar periodo…</option>
              @for (p of periods(); track p.publicUuid) {
                <option [value]="p.publicUuid">{{ p.name }}{{ p.publicUuid === defaultPeriodUuid() ? defaultPeriodLabel() : '' }}</option>
              }
            </select>
            @if (periodSelectionHint()) {
              <p class="mt-1 text-xs text-content-muted" role="status">{{ periodSelectionHint() }}</p>
            }
          </div>
          <div class="sm:col-span-4">
            <label class="label" for="wl-search">Buscar docente</label>
            <input
              id="wl-search"
              class="input"
              type="search"
              placeholder="Nombre o apellido"
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
              [disabled]="rows().length === 0"
            />
            @if (teacherFilterUuid()) {
              <button
                type="button"
                class="mt-2 text-xs font-medium text-primary hover:underline"
                (click)="clearTeacherFilter()"
              >
                Mostrar todos los docentes
              </button>
            }
          </div>
        </div>
      </section>

      @if (errorMessage()) {
        <div role="alert" class="card mb-6 border-l-4 border-l-danger bg-danger/5">
          <div class="card-body text-sm text-danger">{{ errorMessage() }}</div>
        </div>
      }

      <section class="card overflow-hidden">
        @if (loading()) {
          <div class="flex items-center justify-center py-16">
            <app-spinner [size]="24" label="Cargando carga docente…" />
          </div>
        } @else if (!selectedYearUuid()) {
          <app-empty-state
            icon="users"
            title="Seleccioná un año académico"
            description="Elige un año para consultar la carga docente. Se seleccionará automáticamente el año vigente cuando exista."
          />
        } @else if (!selectedPeriodId() && periods().length === 0) {
          <app-empty-state
            icon="calendar"
            title="No hay periodos configurados"
            description="Este año no tiene periodos académicos disponibles. Selecciona otro año o configura sus periodos."
          />
        } @else if (!selectedPeriodId()) {
          <app-empty-state
            icon="calendar"
            title="No hay un periodo vigente o próximo"
            description="Elige manualmente un periodo para consultar su carga docente."
          />
        } @else if (rows().length === 0) {
          <app-empty-state
            icon="users"
            title="Sin carga registrada"
            description="No hay franjas activas para docentes en este periodo."
          />
        } @else if (visibleRows().length === 0) {
          <app-empty-state
            icon="search"
            title="No hay coincidencias"
            description="Prueba con otro nombre o limpia el filtro de docente."
          />
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full min-w-[720px] text-left text-sm">
              <thead class="border-b border-border-subtle bg-surface-subtle text-xs uppercase tracking-wide text-content-muted">
                <tr>
                  <th class="px-4 py-3 font-semibold">
                    <button type="button" class="hover:text-primary" (click)="sortBy('name')">
                      Docente {{ sortIndicator('name') }}
                    </button>
                  </th>
                  <th class="px-4 py-3 text-right font-semibold" title="Suma de duración de las clases">
                    <button type="button" class="hover:text-primary" (click)="sortBy('minutes')">
                      Min / semana {{ sortIndicator('minutes') }}
                    </button>
                  </th>
                  <th
                    class="px-4 py-3 font-semibold text-right"
                    title="Equivalencia de minutos según la duración de clase de cada jornada"
                  >
                    <button type="button" class="hover:text-primary" (click)="sortBy('hours')">
                      Horas acad. {{ sortIndicator('hours') }}
                    </button>
                  </th>
                  <th
                    class="px-4 py-3 font-semibold text-right"
                    title="Cantidad de clases en el horario semanal"
                  >
                    <button type="button" class="hover:text-primary" (click)="sortBy('slots')">
                      Clases {{ sortIndicator('slots') }}
                    </button>
                  </th>
                  <th class="px-4 py-3 text-right font-semibold">
                    <button type="button" class="hover:text-primary" (click)="sortBy('sections')">
                      Secciones {{ sortIndicator('sections') }}
                    </button>
                  </th>
                  <th class="px-4 py-3 text-right font-semibold">
                    <button type="button" class="hover:text-primary" (click)="sortBy('courses')">
                      Cursos {{ sortIndicator('courses') }}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle">
                @for (row of visibleRows(); track row.teacherPublicUuid) {
                  <tr class="hover:bg-surface-subtle/60">
                    <td class="px-4 py-3 font-medium text-content">
                      <a
                        [routerLink]="ROUTES.TEACHERS.detail(row.teacherPublicUuid)"
                        [queryParams]="{ tab: 'schedule' }"
                        class="hover:text-primary hover:underline"
                      >
                        {{ row.firstName }} {{ row.lastName }}
                      </a>
                    </td>
                    <td class="px-4 py-3 text-right tabular-nums">
                      {{ row.minutesPerWeek }}
                      <span class="text-content-muted">
                        ({{ formatClockHours(row.minutesPerWeek) }})
                      </span>
                    </td>
                    <td class="px-4 py-3 text-right tabular-nums font-medium text-content">
                      {{ formatAcademicHours(row) }}
                    </td>
                    <td class="px-4 py-3 text-right tabular-nums">{{ row.slotCount }}</td>
                    <td class="px-4 py-3 text-right tabular-nums">{{ row.sectionCount }}</td>
                    <td class="px-4 py-3 text-right tabular-nums">{{ row.courseCount }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </app-page-container>
  `,
})
export class WorkloadPageComponent implements OnInit {
  private readonly scheduleApi = inject(ScheduleApiService);
  private readonly academicApi = inject(AcademicApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly ROUTES = ROUTES;
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly years = signal<AcademicYearRow[]>([]);
  protected readonly periods = signal<AcademicPeriodRow[]>([]);
  protected readonly selectedYearUuid = signal('');
  protected readonly selectedPeriodId = signal('');
  protected readonly defaultPeriodUuid = signal('');
  protected readonly defaultPeriodLabel = signal('');
  protected readonly periodSelectionHint = signal<string | null>(null);
  protected readonly rows = signal<TeacherWorkloadItem[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly teacherFilterUuid = signal('');
  protected readonly sortKey = signal<WorkloadSortKey>('minutes');
  protected readonly sortDescending = signal(true);
  protected readonly visibleRows = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase();
    const teacherUuid = this.teacherFilterUuid();
    const rows = this.rows().filter((row) => {
      const name = `${row.firstName} ${row.lastName}`.toLocaleLowerCase();
      return (!query || name.includes(query)) && (!teacherUuid || row.teacherPublicUuid === teacherUuid);
    });
    const key = this.sortKey();
    const direction = this.sortDescending() ? -1 : 1;
    return rows.sort((left, right) => {
      const leftValue = this.sortValue(left, key);
      const rightValue = this.sortValue(right, key);
      if (typeof leftValue === 'string' && typeof rightValue === 'string') {
        return direction * leftValue.localeCompare(rightValue);
      }
      return direction * (Number(leftValue) - Number(rightValue));
    });
  });

  protected isActiveYear(year: AcademicYearRow): boolean {
    return year.status === AcademicYearStatus.Active;
  }

  async ngOnInit(): Promise<void> {
    try {
      const years = await firstValueFrom(this.academicApi.listYears());
      this.years.set(years ?? []);
      this.teacherFilterUuid.set(this.route.snapshot.queryParamMap.get('teacher') ?? '');
      const requestedYear = this.route.snapshot.queryParamMap.get('year');
      const selectedYear = selectScheduleYear(years ?? [], requestedYear);
      const yearUuid = selectedYear?.publicUuid ?? '';
      if (yearUuid) {
        const preferredPeriodId = selectedYear?.publicUuid === requestedYear
          ? this.route.snapshot.queryParamMap.get('period')
          : null;
        await this.onYearChange(yearUuid, preferredPeriodId);
      } else {
        this.selectedYearUuid.set('');
        this.periods.set([]);
        this.selectedPeriodId.set('');
        this.defaultPeriodUuid.set('');
        this.defaultPeriodLabel.set('');
        await this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { year: null, period: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    } catch (err: unknown) {
      this.errorMessage.set(this.errMsg(err, 'No se pudieron cargar los años.'));
    }
  }

  protected formatClockHours(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  }

  protected formatAcademicHours(row: TeacherWorkloadItem): string {
    const fromApi = Number(row.academicHoursPerWeek);
    const n = Number.isFinite(fromApi)
      ? fromApi
      : row.minutesPerWeek > 0
        ? row.minutesPerWeek / 45
        : 0;
    if (!Number.isFinite(n)) return '0';
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  protected async onYearChange(yearUuid: string, preferredPeriodId?: string | null): Promise<void> {
    this.selectedYearUuid.set(yearUuid);
    this.selectedPeriodId.set('');
    this.periods.set([]);
    this.defaultPeriodUuid.set('');
    this.defaultPeriodLabel.set('');
    this.periodSelectionHint.set(null);
    this.errorMessage.set(null);
    this.rows.set([]);
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { year: yearUuid || null, period: null },
      queryParamsHandling: 'merge',
    });
    if (!yearUuid) {
      this.periods.set([]);
      return;
    }
    try {
      const periods = await firstValueFrom(
        this.academicApi.listPeriods({ academicYearPublicUuid: yearUuid }),
      );
      const orderedPeriods = [...(periods ?? [])].sort(
        (left, right) => left.startDate.getTime() - right.startDate.getTime(),
      );
      this.periods.set(orderedPeriods);
      const selection = selectSchedulePeriod(orderedPeriods, preferredPeriodId);
      if (selection.state === 'current' || selection.state === 'upcoming') {
        this.defaultPeriodUuid.set(selection.period?.publicUuid ?? '');
        this.defaultPeriodLabel.set(schedulePeriodLabel(selection.state));
      }
      if (selection.period) {
        const hint = selection.state === 'current'
          ? 'Periodo vigente seleccionado automáticamente.'
          : selection.state === 'upcoming'
            ? 'No hay un periodo vigente; seleccionamos el próximo disponible.'
            : null;
        await this.onPeriodChange(selection.period.publicUuid, hint);
      } else if (selection.state === 'none' && orderedPeriods.length > 0) {
        this.periodSelectionHint.set('No hay periodos vigentes ni próximos. Puedes elegir uno anterior.');
      }
    } catch (err: unknown) {
      this.errorMessage.set(this.errMsg(err, 'No se pudieron cargar los periodos.'));
    }
  }

  protected async onPeriodChange(periodId: string, selectionHint: string | null = null): Promise<void> {
    this.selectedPeriodId.set(periodId);
    this.periodSelectionHint.set(selectionHint);
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { period: periodId || null },
      queryParamsHandling: 'merge',
    });
    if (!periodId) {
      this.rows.set([]);
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const list = await firstValueFrom(this.scheduleApi.listTeacherWorkload(periodId));
      this.rows.set([...(list ?? [])]);
    } catch (err: unknown) {
      this.errorMessage.set(this.errMsg(err, 'No se pudo cargar la carga docente.'));
      this.rows.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected sortBy(key: WorkloadSortKey): void {
    if (this.sortKey() === key) {
      this.sortDescending.update((descending) => !descending);
      return;
    }
    this.sortKey.set(key);
    this.sortDescending.set(key !== 'name');
  }

  protected sortIndicator(key: WorkloadSortKey): string {
    if (this.sortKey() !== key) return '';
    return this.sortDescending() ? '↓' : '↑';
  }

  protected clearTeacherFilter(): void {
    this.teacherFilterUuid.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { teacher: null },
      queryParamsHandling: 'merge',
    });
  }

  private sortValue(row: TeacherWorkloadItem, key: WorkloadSortKey): number | string {
    switch (key) {
      case 'name': return `${row.firstName} ${row.lastName}`.toLocaleLowerCase();
      case 'minutes': return row.minutesPerWeek;
      case 'hours': return row.academicHoursPerWeek ?? (row.minutesPerWeek / 45);
      case 'slots': return row.slotCount;
      case 'sections': return row.sectionCount;
      case 'courses': return row.courseCount;
    }
  }

  private errMsg(err: unknown, fallback: string): string {
    if (err && typeof err === 'object' && 'message' in err) {
      return String((err as { message: unknown }).message) || fallback;
    }
    return fallback;
  }
}
