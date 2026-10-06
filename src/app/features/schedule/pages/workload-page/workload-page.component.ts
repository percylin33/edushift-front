import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import {
  EmptyStateComponent,
  IconComponent,
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
    IconComponent,
    EmptyStateComponent,
    SpinnerComponent,
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header
        eyebrow="Horarios"
        title="Carga horaria docente"
        subtitle="Minutos y horas académicas semanales por periodo (según TimeSlots activos)."
      >
        <a [routerLink]="ROUTES.SCHEDULE.JORNADA" class="btn btn-outline btn-sm">
          <app-icon name="calendar" [size]="14" />
          <span>Jornada</span>
        </a>
        <a [routerLink]="ROUTES.SCHEDULE.ROOT" class="btn btn-ghost btn-sm">
          <span>Volver</span>
        </a>
      </app-page-header>

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
                <option [value]="y.publicUuid">{{ y.name }}</option>
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
                <option [value]="p.publicUuid">{{ p.name }}</option>
              }
            </select>
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
        } @else if (!selectedPeriodId()) {
          <app-empty-state
            icon="users"
            title="Seleccioná un periodo"
            description="Elegí año y periodo para ver los minutos semanales por docente."
          />
        } @else if (rows().length === 0) {
          <app-empty-state
            icon="users"
            title="Sin carga registrada"
            description="No hay franjas activas para docentes en este periodo."
          />
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full min-w-[720px] text-left text-sm">
              <thead class="border-b border-border-subtle bg-surface-subtle text-xs uppercase tracking-wide text-content-muted">
                <tr>
                  <th class="px-4 py-3 font-semibold">Docente</th>
                  <th class="px-4 py-3 font-semibold text-right" title="Suma de duración de las franjas de clase">
                    Min / semana
                  </th>
                  <th
                    class="px-4 py-3 font-semibold text-right"
                    title="Minutos ÷ duración de la hora académica de la jornada de cada sección (p. ej. 45 min)"
                  >
                    Horas acad.
                  </th>
                  <th
                    class="px-4 py-3 font-semibold text-right"
                    title="Cantidad de franjas de clase (TimeSlots) en el horario semanal de este periodo"
                  >
                    Franjas
                  </th>
                  <th class="px-4 py-3 font-semibold text-right">Secciones</th>
                  <th class="px-4 py-3 font-semibold text-right">Cursos</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle">
                @for (row of rows(); track row.teacherPublicUuid) {
                  <tr class="hover:bg-surface-subtle/60">
                    <td class="px-4 py-3 font-medium text-content">
                      {{ row.firstName }} {{ row.lastName }}
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

  protected readonly ROUTES = ROUTES;
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly years = signal<AcademicYearRow[]>([]);
  protected readonly periods = signal<AcademicPeriodRow[]>([]);
  protected readonly selectedYearUuid = signal('');
  protected readonly selectedPeriodId = signal('');
  protected readonly rows = signal<TeacherWorkloadItem[]>([]);

  async ngOnInit(): Promise<void> {
    try {
      const years = await firstValueFrom(this.academicApi.listYears());
      this.years.set(years ?? []);
      const active = years?.find((y) => y.status === AcademicYearStatus.Active) ?? years?.[0];
      if (active) {
        await this.onYearChange(active.publicUuid);
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

  protected async onYearChange(yearUuid: string): Promise<void> {
    this.selectedYearUuid.set(yearUuid);
    this.selectedPeriodId.set('');
    this.rows.set([]);
    if (!yearUuid) {
      this.periods.set([]);
      return;
    }
    try {
      const periods = await firstValueFrom(
        this.academicApi.listPeriods({ academicYearPublicUuid: yearUuid }),
      );
      this.periods.set(periods ?? []);
      const first = periods?.[0];
      if (first) {
        await this.onPeriodChange(first.publicUuid);
      }
    } catch (err: unknown) {
      this.errorMessage.set(this.errMsg(err, 'No se pudieron cargar los periodos.'));
    }
  }

  protected async onPeriodChange(periodId: string): Promise<void> {
    this.selectedPeriodId.set(periodId);
    if (!periodId) {
      this.rows.set([]);
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const list = await firstValueFrom(this.scheduleApi.listTeacherWorkload(periodId));
      this.rows.set(
        [...(list ?? [])].sort((a, b) => b.minutesPerWeek - a.minutesPerWeek),
      );
    } catch (err: unknown) {
      this.errorMessage.set(this.errMsg(err, 'No se pudo cargar la carga docente.'));
      this.rows.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private errMsg(err: unknown, fallback: string): string {
    if (err && typeof err === 'object' && 'message' in err) {
      return String((err as { message: unknown }).message) || fallback;
    }
    return fallback;
  }
}
