import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { TeacherAssignmentsStore } from '@features/teachers/store';
import {
  AcademicPeriodRow,
  PERIOD_TYPE_LABELS,
  PeriodType,
  formatPeriodLabel,
  resolveCurrentAcademicPeriod,
} from '@features/academic/models';
import { AcademicApiService } from '@features/academic/services';

/**
 * Sub-componente del tab "Docentes" en
 * {@code section-detail} (FE-4.7 / BE-4.7).
 *
 * <p>Reverse view: dada la sección, lista las assignments
 * activas agrupadas por {@code (teacher, course, period)}. Read-only
 * desde acá — la creación de asignaciones se hace desde el detalle
 * del docente para mantener un único origen de verdad.</p>
 */
@Component({
  selector: 'app-section-teachers-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent, SpinnerComponent],
  template: `
    <section class="card">
      <header class="card-header">
        <div>
          <h3 class="card-title">Docentes asignados</h3>
          <p class="card-description">
            Listado de docentes con asignación activa en esta sección. Por defecto se muestra el
            periodo vigente.
          </p>
        </div>
        @if (periods().length > 0) {
          <label class="sr-only" for="section-teachers-period">Periodo</label>
          <select
            id="section-teachers-period"
            class="select select-sm max-w-[16rem]"
            [ngModel]="periodFilterValue()"
            (ngModelChange)="onPeriodFilterChange($event)"
            [disabled]="isBusy()"
          >
            @for (p of periods(); track p.publicUuid) {
              <option [value]="p.publicUuid">{{ periodOptionLabel(p) }}</option>
            }
            <option [value]="allPeriodsValue">Todos los periodos</option>
          </select>
        }
      </header>

      <div class="card-body">
        @if (isBusy()) {
          <div class="flex items-center justify-center py-10">
            <app-spinner [size]="24" label="Cargando docentes…" />
          </div>
        } @else if (errorMessage()) {
          <div class="alert alert-danger">
            <app-icon name="alert-circle" [size]="18" />
            <p class="flex-1 text-sm">{{ errorMessage() }}</p>
            <button type="button" class="btn btn-ghost btn-sm" (click)="reload()">
              Reintentar
            </button>
          </div>
        } @else if (rows().length === 0) {
          <div class="py-10 text-center">
            <app-icon name="user" [size]="32" class="mx-auto mb-3 text-content-subtle" />
            <p class="text-sm font-medium text-content">Sin docentes asignados todavía</p>
            <p class="mx-auto mt-1 max-w-md text-xs text-content-muted">
              @if (periodFilterValue() === allPeriodsValue) {
                No hay docentes asignados en ningún periodo de esta sección.
              } @else {
                No hay docentes asignados en {{ selectedPeriodLabel() }}.
              }
            </p>
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">Docente</th>
                  <th scope="col">Curso</th>
                  <th scope="col">Periodo</th>
                  <th scope="col">Inicio</th>
                </tr>
              </thead>
              <tbody>
                @for (a of rows(); track a.assignmentPublicUuid) {
                  <tr>
                    <td>
                      <a
                        [routerLink]="teacherRoute(a.teacherPublicUuid)"
                        class="-mx-2 -my-1 block rounded px-2 py-1 hover:bg-surface-muted"
                      >
                        <p class="font-medium text-content">
                          {{ a.teacherFullName }}
                        </p>
                        @if (a.teacherEmail) {
                          <p class="text-xs text-content-muted">
                            {{ a.teacherEmail }}
                          </p>
                        }
                      </a>
                    </td>
                    <td>
                      <span class="font-mono text-xs">{{ a.courseCode }}</span>
                      <span class="text-content-muted"> · </span>
                      <span>{{ a.courseName }}</span>
                    </td>
                    <td>
                      <span class="badge badge-secondary">
                        {{ periodLabel(a) }}
                      </span>
                    </td>
                    <td>
                      <span class="text-xs text-content-muted">
                        {{ a.assignedAt ? (a.assignedAt | date: 'mediumDate') : '—' }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </section>
  `,
})
export class SectionTeachersTabComponent implements OnInit {
  private readonly store = inject(TeacherAssignmentsStore);
  private readonly academicApi = inject(AcademicApiService);

  protected readonly allPeriodsValue = '__ALL_PERIODS__';

  readonly sectionPublicUuid = input.required<string>();
  readonly academicYearPublicUuid = input.required<string>();

  protected readonly periods = signal<AcademicPeriodRow[]>([]);
  protected readonly loadingPeriods = signal(false);
  protected readonly periodFilterValue = signal<string>(this.allPeriodsValue);
  protected readonly currentPeriodId = signal<string | null>(null);

  protected readonly rows = this.store.sectionTeachers;
  protected readonly loading = this.store.loadingSection;
  protected readonly errorMessage = this.store.error;

  protected readonly isBusy = computed(() => this.loading() || this.loadingPeriods());

  protected readonly selectedPeriodLabel = computed(() => {
    const value = this.periodFilterValue();
    if (value === this.allPeriodsValue) return 'todos los periodos';
    const period = this.periods().find((p) => p.publicUuid === value);
    return period ? formatPeriodLabel(period) : 'el periodo seleccionado';
  });

  async ngOnInit(): Promise<void> {
    await this.loadPeriods();
    const current = resolveSectionPeriod(this.periods());
    const defaultPeriodId = current?.publicUuid ?? null;
    this.currentPeriodId.set(defaultPeriodId);
    this.periodFilterValue.set(defaultPeriodId ?? this.allPeriodsValue);
    await this.reload();
  }

  protected periodOptionLabel(period: AcademicPeriodRow): string {
    const label = formatPeriodLabel(period);
    return period.publicUuid === this.currentPeriodId() ? `${label} (vigente)` : label;
  }

  protected async onPeriodFilterChange(value: string): Promise<void> {
    if (value === this.periodFilterValue()) return;
    this.periodFilterValue.set(value);
    await this.reload();
  }

  protected periodLabel(a: {
    periodType: keyof typeof PERIOD_TYPE_LABELS;
    periodOrdinal: number;
  }): string {
    return `${PERIOD_TYPE_LABELS[a.periodType]} ${a.periodOrdinal}`;
  }

  protected teacherRoute(publicUuid: string): string {
    return ROUTES.TEACHERS.detail(publicUuid);
  }

  protected async reload(): Promise<void> {
    this.store.clearError();
    const value = this.periodFilterValue();
    const periodId = value === this.allPeriodsValue ? undefined : value;
    await this.store.loadSectionTeachers(this.sectionPublicUuid(), { periodId });
  }

  private async loadPeriods(): Promise<void> {
    this.loadingPeriods.set(true);
    try {
      const periods = await firstValueFrom(
        this.academicApi.listPeriods({
          academicYearPublicUuid: this.academicYearPublicUuid(),
        }),
      );
      this.periods.set(periods);
    } catch {
      this.periods.set([]);
    } finally {
      this.loadingPeriods.set(false);
    }
  }
}

/** Prefers the bimestre or trimestre that contains today over the annual period. */
function resolveSectionPeriod(periods: AcademicPeriodRow[]): AcademicPeriodRow | null {
  const operational = periods.filter((p) => p.periodType !== PeriodType.Anual);
  return resolveCurrentAcademicPeriod(operational.length > 0 ? operational : periods);
}
