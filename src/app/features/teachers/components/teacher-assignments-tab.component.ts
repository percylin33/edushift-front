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
import {
  AcademicPeriodRow,
  AcademicYearStatus,
  PERIOD_TYPE_LABELS,
  SectionRow,
  formatPeriodLabel,
  resolveCurrentAcademicPeriod,
} from '@features/academic/models';
import { AcademicApiService } from '@features/academic/services';
import { AssignmentRow, TeacherDetail } from '../models';
import { TeacherAssignmentsStore } from '../store';
import { CreateAssignmentModalComponent } from './create-assignment-modal.component';

/** Agrupa filas de asignación bajo un encabezado de periodo. */
interface AssignmentPeriodGroup {
  periodId: string;
  label: string;
  ordinal: number;
  isCurrent: boolean;
  rows: AssignmentRow[];
}

/**
 * Sub-componente del tab "Asignaciones" en
 * {@code teacher-detail}. Aísla el slice {@link TeacherAssignmentsStore}
 * para que el padre solo se preocupe del shell del detail.
 */
@Component({
  selector: 'app-teacher-assignments-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IconComponent,
    SpinnerComponent,
    CreateAssignmentModalComponent,
  ],
  template: `
    <section class="card">
      <header class="card-header">
        <div>
          <h3 class="card-title">Asignaciones</h3>
          <p class="card-description">
            Vincula a {{ teacher().fullName }} con <em>(sección, curso, periodo)</em>. Por defecto
            se muestra el periodo vigente; usa «Todos los periodos» para ver el año completo
            agrupado.
          </p>
        </div>
        <div class="flex flex-wrap items-center justify-end gap-2">
          @if (periods().length > 0) {
            <label class="sr-only" for="assignment-period-filter">Periodo</label>
            <select
              id="assignment-period-filter"
              class="select select-sm max-w-[14rem]"
              [ngModel]="periodFilterValue()"
              (ngModelChange)="onPeriodFilterChange($event)"
              [disabled]="isBusy()"
            >
              @for (p of sortedPeriods(); track p.publicUuid) {
                <option [value]="p.publicUuid">{{ periodOptionLabel(p) }}</option>
              }
              <option [value]="ALL_PERIODS_VALUE">Todos los periodos</option>
            </select>
          }
          <div class="btn-group" role="tablist" aria-label="Filtro estado">
            <button
              type="button"
              class="btn btn-sm"
              [class.btn-primary]="showActiveOnly()"
              [class.btn-ghost]="!showActiveOnly()"
              (click)="setActive(true)"
            >
              Activas
            </button>
            <button
              type="button"
              class="btn btn-sm"
              [class.btn-primary]="!showActiveOnly()"
              [class.btn-ghost]="showActiveOnly()"
              (click)="setActive(false)"
            >
              Histórico
            </button>
          </div>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            [disabled]="saving()"
            (click)="openCreate()"
          >
            <app-icon name="plus" [size]="14" />
            <span>Nueva asignación</span>
          </button>
        </div>
      </header>

      <div class="card-body">
        @if (isBusy()) {
          <div class="flex items-center justify-center py-10">
            <app-spinner [size]="24" label="Cargando asignaciones…" />
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
            <app-icon name="layers" [size]="32" class="mx-auto mb-3 text-content-subtle" />
            <p class="text-sm font-medium text-content">
              @if (showActiveOnly()) {
                Sin asignaciones activas
              } @else {
                Sin asignaciones en el histórico
              }
            </p>
            <p class="mx-auto mt-1 max-w-md text-xs text-content-muted">
              @if (showActiveOnly()) {
                @if (showGroupedByPeriod()) {
                  No hay asignaciones activas en ningún periodo del año.
                } @else {
                  No hay asignaciones activas en {{ selectedPeriodLabel() }}.
                }
              } @else {
                Las asignaciones que se finalicen quedarán visibles aquí.
              }
            </p>
          </div>
        } @else if (showGroupedByPeriod()) {
          <div class="space-y-6">
            @for (group of periodGroups(); track group.periodId) {
              <div>
                <div class="mb-2 flex flex-wrap items-center gap-2">
                  <h4 class="text-sm font-semibold text-content">{{ group.label }}</h4>
                  @if (group.isCurrent) {
                    <span class="badge badge-primary badge-sm">Vigente</span>
                  }
                  <span class="text-xs text-content-muted">
                    {{ group.rows.length }}
                    {{ group.rows.length === 1 ? 'asignación' : 'asignaciones' }}
                  </span>
                </div>
                <div class="overflow-x-auto rounded-md border border-border-subtle">
                  <table class="table">
                    <thead>
                      <tr>
                        <th scope="col">Sección</th>
                        <th scope="col">Curso</th>
                        <th scope="col">Inicio</th>
                        <th scope="col">Fin</th>
                        <th scope="col" class="text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (a of group.rows; track a.publicUuid) {
                        <tr>
                          <td class="font-medium">{{ sectionDisplay(a) }}</td>
                          <td>
                            <span class="font-mono text-xs">{{ a.courseCode }}</span>
                            <span class="text-content-muted"> · </span>
                            <span>{{ a.courseName }}</span>
                          </td>
                          <td>
                            <span class="text-xs text-content-muted">
                              {{ a.assignedAt ? (a.assignedAt | date: 'mediumDate') : '—' }}
                            </span>
                          </td>
                          <td>
                            @if (a.unassignedAt) {
                              <span class="text-xs text-content-muted">
                                {{ a.unassignedAt | date: 'mediumDate' }}
                              </span>
                            } @else {
                              <span class="badge badge-success">Activa</span>
                            }
                          </td>
                          <td class="text-right">
                            <ng-container *ngTemplateOutlet="actionsCell; context: { $implicit: a }" />
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">Sección</th>
                  <th scope="col">Curso</th>
                  <th scope="col">Inicio</th>
                  <th scope="col">Fin</th>
                  <th scope="col" class="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (a of sortedRows(); track a.publicUuid) {
                  <tr>
                    <td class="font-medium">{{ sectionDisplay(a) }}</td>
                    <td>
                      <span class="font-mono text-xs">{{ a.courseCode }}</span>
                      <span class="text-content-muted"> · </span>
                      <span>{{ a.courseName }}</span>
                    </td>
                    <td>
                      <span class="text-xs text-content-muted">
                        {{ a.assignedAt ? (a.assignedAt | date: 'mediumDate') : '—' }}
                      </span>
                    </td>
                    <td>
                      @if (a.unassignedAt) {
                        <span class="text-xs text-content-muted">
                          {{ a.unassignedAt | date: 'mediumDate' }}
                        </span>
                      } @else {
                        <span class="badge badge-success">Activa</span>
                      }
                    </td>
                    <td class="text-right">
                      <ng-container *ngTemplateOutlet="actionsCell; context: { $implicit: a }" />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </section>

    <ng-template #actionsCell let-a>
      <div class="flex justify-end gap-1">
        <a
          [routerLink]="evaluationsRoute(a.publicUuid)"
          class="btn btn-ghost btn-xs"
          title="Ver registros de esta asignación"
        >
          <app-icon name="target" [size]="14" />
          <span>Registros</span>
        </a>
        @if (a.active) {
          <button
            type="button"
            class="btn btn-ghost btn-xs text-danger-600 hover:bg-danger-50"
            [disabled]="saving()"
            (click)="onSoftEnd(a.publicUuid, sectionDisplay(a), a.courseCode)"
          >
            <app-icon name="x" [size]="14" />
            <span>Finalizar</span>
          </button>
        } @else {
          <span class="text-xs text-content-muted">cerrada</span>
        }
      </div>
    </ng-template>

    @if (showCreate()) {
      <app-create-assignment-modal
        [teacher]="teacher()"
        (closed)="closeCreate()"
        (created)="onCreated()"
      />
    }
  `,
})
export class TeacherAssignmentsTabComponent implements OnInit {
  private readonly store = inject(TeacherAssignmentsStore);
  private readonly academicApi = inject(AcademicApiService);

  protected readonly ALL_PERIODS_VALUE = '__ALL_PERIODS__';

  readonly teacher = input.required<TeacherDetail>();

  protected readonly periods = signal<AcademicPeriodRow[]>([]);
  protected readonly sections = signal<SectionRow[]>([]);
  protected readonly loadingCatalogs = signal(false);
  protected readonly periodFilterValue = signal<string>(this.ALL_PERIODS_VALUE);
  protected readonly currentPeriodId = signal<string | null>(null);

  protected readonly rows = this.store.assignments;
  protected readonly loading = this.store.loading;
  protected readonly saving = this.store.saving;
  protected readonly errorMessage = this.store.error;
  protected readonly showCreate = signal<boolean>(false);

  protected readonly showActiveOnly = computed<boolean>(
    () => this.store.filters().active !== false,
  );

  protected readonly isBusy = computed(() => this.loading() || this.loadingCatalogs());

  protected readonly showGroupedByPeriod = computed(
    () => this.periodFilterValue() === this.ALL_PERIODS_VALUE,
  );

  protected readonly sortedPeriods = computed(() =>
    [...this.periods()].sort((a, b) => a.ordinal - b.ordinal),
  );

  private readonly sectionGradeByUuid = computed(() => {
    const map = new Map<string, string>();
    for (const section of this.sections()) {
      map.set(section.publicUuid, section.gradeName);
    }
    return map;
  });

  private readonly periodLabelByUuid = computed(() => {
    const map = new Map<string, string>();
    for (const period of this.periods()) {
      map.set(period.publicUuid, formatPeriodLabel(period));
    }
    return map;
  });

  protected readonly sortedRows = computed(() => this.sortAssignmentRows(this.rows()));

  protected readonly periodGroups = computed<AssignmentPeriodGroup[]>(() => {
    const currentId = this.currentPeriodId();
    const byPeriod = new Map<string, AssignmentRow[]>();

    for (const row of this.rows()) {
      const bucket = byPeriod.get(row.academicPeriodPublicUuid) ?? [];
      bucket.push(row);
      byPeriod.set(row.academicPeriodPublicUuid, bucket);
    }

    return [...byPeriod.entries()]
      .map(([periodId, groupRows]) => ({
        periodId,
        label: this.periodLabelForAssignment(periodId, groupRows[0]),
        ordinal: groupRows[0]?.periodOrdinal ?? 0,
        isCurrent: periodId === currentId,
        rows: this.sortAssignmentRows(groupRows),
      }))
      .sort((a, b) => a.ordinal - b.ordinal);
  });

  protected readonly selectedPeriodLabel = computed(() => {
    const value = this.periodFilterValue();
    if (value === this.ALL_PERIODS_VALUE) return 'todos los periodos';
    return this.periodLabelByUuid().get(value) ?? 'el periodo seleccionado';
  });

  protected evaluationsRoute(assignmentPublicUuid: string): string {
    return ROUTES.EVALUATIONS.byAssignment(assignmentPublicUuid);
  }

  async ngOnInit(): Promise<void> {
    await this.loadCatalogs();

    const current = resolveCurrentAcademicPeriod(this.periods());
    const defaultPeriodId = current?.publicUuid ?? null;
    this.currentPeriodId.set(defaultPeriodId);
    this.periodFilterValue.set(defaultPeriodId ?? this.ALL_PERIODS_VALUE);

    await this.store.loadAssignmentsFor(this.teacher().publicUuid, {
      active: true,
      periodId: defaultPeriodId ?? undefined,
    });
  }

  protected sectionDisplay(row: AssignmentRow): string {
    const gradeName = this.sectionGradeByUuid().get(row.sectionPublicUuid);
    return gradeName ? `${gradeName} · ${row.sectionName}` : row.sectionName;
  }

  protected periodOptionLabel(period: AcademicPeriodRow): string {
    const label = formatPeriodLabel(period);
    return period.publicUuid === this.currentPeriodId() ? `${label} (vigente)` : label;
  }

  protected async onPeriodFilterChange(value: string): Promise<void> {
    if (value === this.periodFilterValue()) return;
    this.periodFilterValue.set(value);
    const periodId = value === this.ALL_PERIODS_VALUE ? undefined : value;
    await this.store.setPeriodFilter(periodId);
  }

  protected async setActive(active: boolean): Promise<void> {
    if (this.showActiveOnly() === active) return;
    await this.store.setActiveFilter(active);
  }

  protected async reload(): Promise<void> {
    this.store.clearError();
    await this.store.loadAssignmentsFor(this.teacher().publicUuid, this.store.filters());
  }

  protected openCreate(): void {
    this.store.clearError();
    this.showCreate.set(true);
  }

  protected closeCreate(): void {
    this.showCreate.set(false);
  }

  protected async onCreated(): Promise<void> {
    this.showCreate.set(false);
    await this.reload();
  }

  protected async onSoftEnd(
    publicUuid: string,
    sectionLabel: string,
    courseCode: string,
  ): Promise<void> {
    const ok = confirm(
      `¿Finalizar la asignación de ${courseCode} en ${sectionLabel}?\n\n` +
        'La row quedará en el histórico (status terminado) y dejará de\n' +
        'aparecer en la lista de asignaciones activas.',
    );
    if (!ok) return;
    await this.store.softEnd(publicUuid);
  }

  private periodLabelForAssignment(periodId: string, row?: AssignmentRow): string {
    const fromCatalog = this.periodLabelByUuid().get(periodId);
    if (fromCatalog) return fromCatalog;
    if (!row) return 'Periodo';
    return `${PERIOD_TYPE_LABELS[row.periodType]} ${row.periodOrdinal}`;
  }

  private sortAssignmentRows(rows: AssignmentRow[]): AssignmentRow[] {
    return [...rows].sort((a, b) => {
      const sectionCmp = this.sectionDisplay(a).localeCompare(this.sectionDisplay(b), 'es');
      if (sectionCmp !== 0) return sectionCmp;
      return a.courseCode.localeCompare(b.courseCode, 'es');
    });
  }

  private async loadCatalogs(): Promise<void> {
    this.loadingCatalogs.set(true);
    try {
      const years = await firstValueFrom(this.academicApi.listYears());
      const activeYear = years.find((y) => y.status === AcademicYearStatus.Active) ?? null;
      if (!activeYear) {
        this.periods.set([]);
        this.sections.set([]);
        return;
      }

      const [sections, periods] = await Promise.all([
        firstValueFrom(
          this.academicApi.listSections({
            academicYearPublicUuid: activeYear.publicUuid,
          }),
        ),
        firstValueFrom(
          this.academicApi.listPeriods({
            academicYearPublicUuid: activeYear.publicUuid,
          }),
        ),
      ]);

      this.sections.set(sections);
      this.periods.set(periods);
    } catch {
      this.periods.set([]);
      this.sections.set([]);
    } finally {
      this.loadingCatalogs.set(false);
    }
  }
}
