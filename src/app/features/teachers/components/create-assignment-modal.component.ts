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
  signal
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
  SectionRow
} from '@features/academic/models';
import { TeacherDetail } from '../models';
import { TeacherAssignmentsStore } from '../store';

/**
 * Dialog "Nueva asignación" — crea una row en
 * {@code teacher_assignments} (BE-4.7).
 *
 * <h3>Cascada Section → Course → Period</h3>
 * <ol>
 *   <li>El admin selecciona una <em>section</em> del año académico
 *       activo.</li>
 *   <li>El dropdown de <em>course</em> se filtra: marca como
 *       deshabilitados los que <strong>no</strong> están vinculados al
 *       {@code level} del grado de la sección. El tooltip explica el
 *       motivo (anticipa el 409
 *       {@code COURSE_NOT_APPLICABLE_TO_SECTION_LEVEL} del back).</li>
 *   <li>El dropdown de <em>period</em> se restringe a los periodos
 *       del año académico de la sección (anticipa
 *       {@code ASSIGNMENT_YEAR_MISMATCH}).</li>
 * </ol>
 *
 * <h3>Validaciones cliente</h3>
 * Las cuatro reglas del back se validan localmente para guiar la UX,
 * pero el formulario sigue mandando la mutación si todo se ve OK
 * — los 409 que el back devuelva se renderizan como banner.
 */
@Component({
  selector: 'app-create-assignment-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IconComponent, SpinnerComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assignment-title"
      (click)="onBackdropClick($event)"
    >
      <div
        class="card w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]"
        (click)="$event.stopPropagation()"
      >
        <header class="card-header">
          <div>
            <h2 id="assignment-title" class="card-title">Nueva asignación</h2>
            <p class="card-description">
              Asigna a {{ teacher().fullName }} a una sección, curso y periodo
              del año académico activo.
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
                No hay un año académico <strong>activo</strong>. Activa uno
                desde <em>Académico → Años</em> antes de crear asignaciones.
              </p>
            </div>
          } @else if (sections().length === 0) {
            <div class="alert alert-warning">
              <app-icon name="info" [size]="18" />
              <p class="flex-1 text-sm">
                El año {{ activeYear()?.name }} no tiene secciones creadas.
                Crea al menos una desde <em>Académico → Secciones</em>.
              </p>
            </div>
          } @else if (periods().length === 0) {
            <div class="alert alert-warning">
              <app-icon name="info" [size]="18" />
              <p class="flex-1 text-sm">
                El año {{ activeYear()?.name }} no tiene periodos creados.
                Genera la calendarización desde <em>Académico → Periodos</em>.
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
              <label class="label" for="assignment-course">
                Curso <span class="text-danger-500">*</span>
              </label>
              <select
                id="assignment-course"
                class="select"
                [ngModel]="courseUuid()"
                (ngModelChange)="courseUuid.set($event)"
                [disabled]="!sectionUuid() || saving() || courses().length === 0"
              >
                <option value="" disabled>
                  @if (sectionUuid()) {
                    Seleccionar curso…
                  } @else {
                    Primero selecciona una sección
                  }
                </option>
                @for (c of courses(); track c.publicUuid) {
                  <option
                    [value]="c.publicUuid"
                    [disabled]="!isCourseApplicable(c)"
                    [title]="
                      !isCourseApplicable(c)
                        ? 'Este curso no está vinculado al nivel ' + selectedLevelCode() + '.'
                        : null
                    "
                  >
                    {{ c.code }} — {{ c.name }}
                    @if (!isCourseApplicable(c)) {
                      (no aplica al nivel)
                    }
                  </option>
                }
              </select>
              @if (sectionUuid() && courses().length === 0) {
                <p class="hint mt-1 text-content-muted">
                  No hay cursos creados todavía. Crea uno desde
                  <em>Académico → Cursos</em>.
                </p>
              }
              @if (sectionUuid() && hasOnlyInapplicableCourses()) {
                <p class="hint mt-1 text-warning-600">
                  Ningún curso está vinculado al nivel
                  <strong>{{ selectedLevelCode() }}</strong>. Asocia uno desde
                  el detalle del curso.
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
                @for (p of periods(); track p.publicUuid) {
                  <option [value]="p.publicUuid">
                    {{ p.name }} ({{ periodTypeLabel(p.periodType) }})
                  </option>
                }
              </select>
            </div>

            <div class="field">
              <label class="label" for="assignment-notes">
                Notas <span class="text-content-muted text-xs">(opcional)</span>
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
            <span>Crear asignación</span>
          </button>
        </footer>
      </div>
    </div>
  `
})
export class CreateAssignmentModalComponent implements OnInit {
  private readonly academicApi = inject(AcademicApiService);
  private readonly store = inject(TeacherAssignmentsStore);

  readonly teacher = input.required<TeacherDetail>();

  readonly closed  = output<void>();
  readonly created = output<void>();

  /** Año académico ACTIVE del tenant; necesario para gateway de cascada. */
  protected readonly activeYear = signal<AcademicYearRow | null>(null);
  protected readonly sections   = signal<SectionRow[]>([]);
  protected readonly courses    = signal<CourseRow[]>([]);
  protected readonly periods    = signal<AcademicPeriodRow[]>([]);

  protected readonly loadingCatalogs = signal(false);
  protected readonly saving = this.store.saving;
  protected readonly errorMessage = this.store.error;

  protected readonly sectionUuid = signal<string>('');
  protected readonly courseUuid  = signal<string>('');
  protected readonly periodUuid  = signal<string>('');
  protected readonly notes       = signal<string>('');

  /** Sección actualmente seleccionada (para resolver el level). */
  protected readonly selectedSection = computed<SectionRow | null>(() => {
    const id = this.sectionUuid();
    if (!id) return null;
    return this.sections().find((s) => s.publicUuid === id) ?? null;
  });

  protected readonly selectedLevelCode = computed<string>(
    () => this.selectedSection()?.levelCode ?? ''
  );

  protected readonly hasOnlyInapplicableCourses = computed<boolean>(() => {
    const all = this.courses();
    if (all.length === 0) return false;
    return all.every((c) => !this.isCourseApplicable(c));
  });

  protected readonly canSubmit = computed<boolean>(() => {
    if (!this.sectionUuid() || !this.courseUuid() || !this.periodUuid())
      return false;
    const course = this.courses().find(
      (c) => c.publicUuid === this.courseUuid()
    );
    return !course || this.isCourseApplicable(course);
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

  /** El curso debe estar vinculado al level del grado de la sección. */
  protected isCourseApplicable(course: CourseRow): boolean {
    const sec = this.selectedSection();
    if (!sec) return true;
    return course.levels.some((l) => l.publicUuid === sec.levelPublicUuid);
  }

  protected periodTypeLabel(type: AcademicPeriodRow['periodType']): string {
    return PERIOD_TYPE_LABELS[type];
  }

  protected onSectionChange(value: string): void {
    this.sectionUuid.set(value);
    /* Si el curso elegido deja de aplicar al level nuevo, lo
     * limpiamos para forzar al admin a re-seleccionar. */
    const course = this.courses().find(
      (c) => c.publicUuid === this.courseUuid()
    );
    if (course && !this.isCourseApplicable(course)) {
      this.courseUuid.set('');
    }
  }

  protected async onSubmit(): Promise<void> {
    if (!this.canSubmit() || this.saving()) return;
    const result = await this.store.create(this.teacher().publicUuid, {
      sectionPublicUuid: this.sectionUuid(),
      coursePublicUuid: this.courseUuid(),
      academicPeriodPublicUuid: this.periodUuid(),
      notes: this.notes().trim() || undefined
    });
    if (result) this.created.emit();
  }

  private async fetchCatalogs(): Promise<void> {
    this.loadingCatalogs.set(true);
    try {
      /* 1) Localizamos el año ACTIVE. Sin él la cascada no tiene sentido. */
      const years = await firstValueFrom(this.academicApi.listYears());
      const active =
        years.find((y) => y.status === AcademicYearStatus.Active) ?? null;
      this.activeYear.set(active);

      if (!active) return;

      /* 2) Secciones del año activo + periodos del mismo. Cursos los
       *    cargamos sin filtro de level (chips dentro del row indican
       *    cuáles aplican y cuáles no). */
      const [sections, courses, periods] = await Promise.all([
        firstValueFrom(
          this.academicApi.listSections({
            academicYearPublicUuid: active.publicUuid
          })
        ),
        firstValueFrom(this.academicApi.listCourses({ isActive: true })),
        firstValueFrom(
          this.academicApi.listPeriods({
            academicYearPublicUuid: active.publicUuid
          })
        )
      ]);
      this.sections.set(sections);
      this.courses.set(courses);
      this.periods.set(periods);
    }
    catch {
      this.activeYear.set(null);
      this.sections.set([]);
      this.courses.set([]);
      this.periods.set([]);
    }
    finally {
      this.loadingCatalogs.set(false);
    }
  }
}
