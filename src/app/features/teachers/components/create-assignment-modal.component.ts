import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { AcademicApiService } from '@features/academic/services';
import {
  AcademicPeriodRow,
  AcademicYearRow,
  AcademicYearStatus,
  CourseRow,
  PERIOD_TYPE_LABELS,
  PeriodType,
  SectionRow,
} from '@features/academic/models';
import { TeacherDetail } from '../models';
import { TeacherAssignmentsStore } from '../store';

/**
 * Dialog "Nueva asignación" — crea una o N rows en
 * {@code teacher_assignments} (BE-4.7).
 *
 * <h3>Cascada Section → Courses → Period</h3>
 * <ol>
 *   <li>Sección del año académico activo.</li>
 *   <li>Uno o varios cursos aplicables al nivel de la sección
 *       (docente de aula: “Seleccionar todos”; especialista: 1–2 cursos).</li>
 *   <li>Periodo individual o “Todo el año” (bimestres/trimestres).</li>
 * </ol>
 * El producto cursos × periodos se crea en lote; duplicados se omiten.
 */
@Component({
  selector: 'app-create-assignment-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IconComponent, SpinnerComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assignment-title"
      (click)="onBackdropClick($event)"
    >
      <div
        class="card flex max-h-[90vh] w-full max-w-2xl flex-col shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <header class="card-header">
          <div>
            <h2 id="assignment-title" class="card-title">Nueva asignación</h2>
            <p class="card-description">
              Asigna a {{ teacher().fullName }} a una sección. Elige uno o varios cursos (útil para
              docente de aula) y un periodo o todo el año.
            </p>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-icon"
            aria-label="Cerrar"
            (click)="close()"
          >
            <app-icon name="x" [size]="18" />
          </button>
        </header>

        <div class="card-body flex flex-col gap-3 overflow-y-auto">
          @if (errorMessage(); as err) {
            <div class="alert alert-danger">
              <app-icon name="alert-circle" [size]="18" />
              <p class="flex-1 text-sm">{{ err }}</p>
            </div>
          }

          @if (loadingCatalogs()) {
            <div class="flex items-center justify-center py-10">
              <app-spinner [size]="24" label="Cargando catálogos…" />
            </div>
          } @else if (!activeYear()) {
            <div class="alert alert-warning">
              <app-icon name="info" [size]="18" />
              <p class="flex-1 text-sm">
                No hay un año académico <strong>activo</strong>. Activa uno desde
                <em>Académico → Años</em> antes de crear asignaciones.
              </p>
            </div>
          } @else if (sections().length === 0) {
            <div class="alert alert-warning">
              <app-icon name="info" [size]="18" />
              <p class="flex-1 text-sm">
                El año {{ activeYear()?.name }} no tiene secciones creadas. Crea al menos una desde
                <em>Académico → Secciones</em>.
              </p>
            </div>
          } @else if (periods().length === 0) {
            <div class="alert alert-warning">
              <app-icon name="info" [size]="18" />
              <p class="flex-1 text-sm">
                El año {{ activeYear()?.name }} no tiene periodos creados. Genera la calendarización
                desde <em>Académico → Periodos</em>.
              </p>
            </div>
          } @else {
            <div class="field">
              <label class="label" for="assignment-section">
                Sección <span class="text-danger-500">*</span>
              </label>
              <select
                id="assignment-section"
                class="select"
                [ngModel]="sectionUuid()"
                (ngModelChange)="onSectionChange($event)"
                [disabled]="saving()"
              >
                <option value="" disabled>Seleccionar sección…</option>
                @for (s of sections(); track s.publicUuid) {
                  <option [value]="s.publicUuid">
                    {{ s.gradeName }} · {{ s.name }} ({{ s.levelCode }})
                  </option>
                }
              </select>
            </div>

            <div class="field">
              <div class="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <label class="label mb-0">
                  Cursos <span class="text-danger-500">*</span>
                </label>
                @if (sectionUuid() && applicableCourses().length > 0) {
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs"
                      [disabled]="saving()"
                      (click)="selectAllApplicableCourses()"
                    >
                      Seleccionar todos
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs"
                      [disabled]="saving() || selectedCourseUuids().length === 0"
                      (click)="clearSelectedCourses()"
                    >
                      Ninguno
                    </button>
                  </div>
                }
              </div>

              @if (!sectionUuid()) {
                <p class="hint text-content-muted">Primero selecciona una sección.</p>
              } @else if (courses().length === 0) {
                <p class="hint text-content-muted">
                  No hay cursos creados todavía. Crea uno desde
                  <em>Académico → Cursos</em>.
                </p>
              } @else if (hasOnlyInapplicableCourses()) {
                <p class="hint text-warning-600">
                  Ningún curso está vinculado al nivel
                  <strong>{{ selectedLevelCode() }}</strong
                  >. Asocia uno desde el detalle del curso.
                </p>
              } @else {
                <div
                  class="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border-subtle bg-surface p-2"
                  role="group"
                  aria-label="Cursos de la sección"
                >
                  @for (c of applicableCourses(); track c.publicUuid) {
                    <label
                      class="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-subtle"
                    >
                      <input
                        type="checkbox"
                        class="mt-0.5"
                        [checked]="isCourseSelected(c.publicUuid)"
                        [disabled]="saving()"
                        (change)="toggleCourse(c.publicUuid, $event)"
                      />
                      <span class="min-w-0">
                        <span class="font-medium text-content">{{ c.code }}</span>
                        <span class="text-content-muted"> — {{ c.name }}</span>
                      </span>
                    </label>
                  }
                </div>
                <p class="hint mt-1 text-content-muted">
                  {{ selectedCourseUuids().length }} de {{ applicableCourses().length }} seleccionados.
                  Desmarca los que dictará un especialista.
                </p>
              }
            </div>

            <div class="field">
              <label class="label" for="assignment-period">
                Periodo <span class="text-danger-500">*</span>
              </label>
              <select
                id="assignment-period"
                class="select"
                [ngModel]="periodUuid()"
                (ngModelChange)="periodUuid.set($event)"
                [disabled]="saving()"
              >
                <option value="" disabled>Seleccionar periodo…</option>
                @if (bulkPeriods().length > 0) {
                  <option [value]="ALL_YEAR_VALUE">
                    Todo el año — {{ bulkPeriods().length }}
                    {{ bulkPeriodTypeLabel() }} ({{ activeYear()?.name }})
                  </option>
                }
                @for (p of periods(); track p.publicUuid) {
                  <option [value]="p.publicUuid">
                    {{ p.name }} ({{ periodTypeLabel(p.periodType) }})
                  </option>
                }
              </select>
            </div>

            @if (plannedCount() > 1) {
              <p class="text-xs text-content-muted">
                Se crearán hasta <strong>{{ plannedCount() }}</strong> asignaciones
                ({{ selectedCourseUuids().length }} curso{{
                  selectedCourseUuids().length === 1 ? '' : 's'
                }}
                ×
                {{ applyAllPeriods() ? bulkPeriods().length : 1 }} periodo{{
                  applyAllPeriods() && bulkPeriods().length > 1 ? 's' : ''
                }}). Las que ya existan se omiten.
              </p>
            }

            <div class="field">
              <label class="label" for="assignment-notes">
                Notas <span class="text-xs text-content-muted">(opcional)</span>
              </label>
              <textarea
                id="assignment-notes"
                class="input"
                rows="2"
                maxlength="1000"
                placeholder="Comentario interno para el admin"
                [ngModel]="notes()"
                (ngModelChange)="notes.set($event)"
                [disabled]="saving()"
              ></textarea>
            </div>
          }
        </div>

        <footer class="card-footer">
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            [disabled]="saving()"
            (click)="close()"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            [disabled]="!canSubmit() || saving()"
            (click)="onSubmit()"
          >
            @if (saving()) {
              <app-spinner [size]="14" />
            }
            <span>
              @if (plannedCount() > 1) {
                Crear {{ plannedCount() }} asignaciones
              } @else {
                Crear asignación
              }
            </span>
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class CreateAssignmentModalComponent implements OnInit {
  private readonly academicApi = inject(AcademicApiService);
  private readonly store = inject(TeacherAssignmentsStore);

  /** Sentinel en el select de periodo → crear para todos los periodos de evaluación. */
  protected readonly ALL_YEAR_VALUE = '__ALL_YEAR__';

  readonly teacher = input.required<TeacherDetail>();

  readonly closed = output<void>();
  readonly created = output<void>();

  protected readonly activeYear = signal<AcademicYearRow | null>(null);
  protected readonly sections = signal<SectionRow[]>([]);
  protected readonly courses = signal<CourseRow[]>([]);
  protected readonly periods = signal<AcademicPeriodRow[]>([]);

  protected readonly loadingCatalogs = signal(false);
  protected readonly saving = this.store.saving;
  protected readonly errorMessage = this.store.error;

  protected readonly sectionUuid = signal<string>('');
  protected readonly selectedCourseUuids = signal<string[]>([]);
  protected readonly periodUuid = signal<string>('');
  protected readonly notes = signal<string>('');

  protected readonly selectedSection = computed<SectionRow | null>(() => {
    const id = this.sectionUuid();
    if (!id) return null;
    return this.sections().find((s) => s.publicUuid === id) ?? null;
  });

  protected readonly selectedLevelCode = computed<string>(
    () => this.selectedSection()?.levelCode ?? '',
  );

  protected readonly applicableCourses = computed<CourseRow[]>(() =>
    this.courses().filter((c) => this.isCourseApplicable(c)),
  );

  protected readonly hasOnlyInapplicableCourses = computed<boolean>(() => {
    const all = this.courses();
    if (all.length === 0) return false;
    return all.every((c) => !this.isCourseApplicable(c));
  });

  protected readonly bulkPeriods = computed<AcademicPeriodRow[]>(() => {
    const all = [...this.periods()].sort((a, b) => a.ordinal - b.ordinal);
    const bimestres = all.filter((p) => p.periodType === PeriodType.Bimestre);
    if (bimestres.length > 0) return bimestres;
    const trimestres = all.filter((p) => p.periodType === PeriodType.Trimestre);
    if (trimestres.length > 0) return trimestres;
    return all;
  });

  protected readonly bulkPeriodTypeLabel = computed(() => {
    const list = this.bulkPeriods();
    if (list.length === 0) return 'periodos';
    const type = list[0].periodType;
    if (type === PeriodType.Bimestre) return 'bimestres';
    if (type === PeriodType.Trimestre) return 'trimestres';
    if (type === PeriodType.Anual) return 'periodo anual';
    return PERIOD_TYPE_LABELS[type] ?? 'periodos';
  });

  protected readonly applyAllPeriods = computed(
    () => this.periodUuid() === this.ALL_YEAR_VALUE,
  );

  protected readonly selectedPeriodUuids = computed<string[]>(() => {
    if (this.applyAllPeriods()) {
      return this.bulkPeriods().map((p) => p.publicUuid);
    }
    const id = this.periodUuid();
    return id ? [id] : [];
  });

  protected readonly plannedCount = computed(
    () => this.selectedCourseUuids().length * this.selectedPeriodUuids().length,
  );

  protected readonly canSubmit = computed<boolean>(() => {
    if (!this.sectionUuid()) return false;
    if (this.selectedCourseUuids().length === 0) return false;
    if (this.selectedPeriodUuids().length === 0) return false;
    return true;
  });

  async ngOnInit(): Promise<void> {
    this.store.clearError();
    await this.fetchCatalogs();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.saving()) this.close();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.saving()) this.close();
  }

  protected close(): void {
    this.store.clearError();
    this.closed.emit();
  }

  protected isCourseApplicable(course: CourseRow): boolean {
    const sec = this.selectedSection();
    if (!sec) return true;
    return course.levels.some((l) => l.publicUuid === sec.levelPublicUuid);
  }

  protected isCourseSelected(courseUuid: string): boolean {
    return this.selectedCourseUuids().includes(courseUuid);
  }

  protected periodTypeLabel(type: AcademicPeriodRow['periodType']): string {
    return PERIOD_TYPE_LABELS[type];
  }

  protected onSectionChange(value: string): void {
    this.sectionUuid.set(value);
    /* Solo conservar cursos que sigan aplicando al nuevo nivel. */
    const kept = this.selectedCourseUuids().filter((id) => {
      const course = this.courses().find((c) => c.publicUuid === id);
      return course ? this.isCourseApplicable(course) : false;
    });
    this.selectedCourseUuids.set(kept);
  }

  protected toggleCourse(courseUuid: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedCourseUuids.update((ids) => {
      if (checked) {
        return ids.includes(courseUuid) ? ids : [...ids, courseUuid];
      }
      return ids.filter((id) => id !== courseUuid);
    });
  }

  protected selectAllApplicableCourses(): void {
    this.selectedCourseUuids.set(this.applicableCourses().map((c) => c.publicUuid));
  }

  protected clearSelectedCourses(): void {
    this.selectedCourseUuids.set([]);
  }

  protected async onSubmit(): Promise<void> {
    if (!this.canSubmit() || this.saving()) return;

    const result = await this.store.createCombinations(
      this.teacher().publicUuid,
      this.sectionUuid(),
      this.selectedCourseUuids(),
      this.selectedPeriodUuids(),
      this.notes().trim() || undefined,
    );
    if (result) this.created.emit();
  }

  private async fetchCatalogs(): Promise<void> {
    this.loadingCatalogs.set(true);
    try {
      const years = await firstValueFrom(this.academicApi.listYears());
      const active = years.find((y) => y.status === AcademicYearStatus.Active) ?? null;
      this.activeYear.set(active);

      if (!active) return;

      const [sections, courses, periods] = await Promise.all([
        firstValueFrom(
          this.academicApi.listSections({
            academicYearPublicUuid: active.publicUuid,
          }),
        ),
        firstValueFrom(this.academicApi.listCourses({ isActive: true })),
        firstValueFrom(
          this.academicApi.listPeriods({
            academicYearPublicUuid: active.publicUuid,
          }),
        ),
      ]);
      this.sections.set(sections);
      this.courses.set(courses);
      this.periods.set(periods);
    } catch {
      this.activeYear.set(null);
      this.sections.set([]);
      this.courses.set([]);
      this.periods.set([]);
    } finally {
      this.loadingCatalogs.set(false);
    }
  }
}
