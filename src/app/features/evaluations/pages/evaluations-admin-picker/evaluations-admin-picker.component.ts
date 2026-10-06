import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { EmploymentStatus } from '@core/enums';
import {
  AcademicPeriodRow,
  AcademicYearStatus,
  CourseRow,
  SectionRow,
  formatPeriodLabel,
  formatSectionDisplayLabel,
  resolveCurrentAcademicPeriod,
} from '@features/academic/models';
import { AcademicApiService } from '@features/academic/services';
import {
  courseTintAvatarBg,
  courseTintBg,
  courseTintBorder,
  resolveCourseVisual,
} from '@features/academic/utils/course-visual.util';
import { LmsSectionContextService } from '@features/lms/services/lms-section-context.service';
import { AssignmentRow } from '@features/teachers/models';
import { TeachersApiService } from '@features/teachers/services';
import {
  EmptyStateComponent,
  IconComponent,
  IconName,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';

/**
 * Picker de asignaciones del colegio para {@code TENANT_ADMIN}.
 * Filtros: periodo, sección, curso, docente → abre Registros de la assignment.
 */
@Component({
  selector: 'app-evaluations-admin-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    EmptyStateComponent,
    IconComponent,
    PageContainerComponent,
    PageHeaderComponent,
    SpinnerComponent,
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header
        eyebrow="Registros"
        title="Registros"
        subtitle="Elige una asignación del colegio para ver o cargar notas."
      >
        <a [routerLink]="teachersRoute" class="btn btn-ghost btn-sm">
          <app-icon name="users" [size]="16" />
          <span>Ir a Docentes</span>
        </a>
      </app-page-header>

      <section class="card mb-4">
        <div class="card-body grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="field">
            <label class="label" for="reg-period">Periodo</label>
            <select
              id="reg-period"
              class="input"
              [value]="periodId()"
              (change)="onPeriodChange($any($event.target).value)"
            >
              <option value="">Todos los periodos</option>
              @for (p of periods(); track p.publicUuid) {
                <option [value]="p.publicUuid">{{ periodLabel(p) }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label class="label" for="reg-section">Sección</label>
            <select
              id="reg-section"
              class="input"
              [value]="sectionId()"
              (change)="onSectionChange($any($event.target).value)"
            >
              <option value="">Todas las secciones</option>
              @for (s of sections(); track s.publicUuid) {
                <option [value]="s.publicUuid">{{ sectionLabel(s) }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label class="label" for="reg-course">Curso</label>
            <select
              id="reg-course"
              class="input"
              [value]="courseId()"
              (change)="onCourseChange($any($event.target).value)"
            >
              <option value="">Todos los cursos</option>
              @for (c of courses(); track c.publicUuid) {
                <option [value]="c.publicUuid">
                  {{ c.code ? c.code + ' · ' : '' }}{{ c.name }}
                </option>
              }
            </select>
          </div>

          <div class="field">
            <label class="label" for="reg-teacher">Docente</label>
            <select
              id="reg-teacher"
              class="input"
              [value]="teacherId()"
              (change)="onTeacherChange($any($event.target).value)"
            >
              <option value="">Todos los docentes</option>
              @for (t of teachers(); track t.publicUuid) {
                <option [value]="t.publicUuid">{{ t.fullName }}</option>
              }
            </select>
          </div>
        </div>
      </section>

      @if (catalogLoading()) {
        <div class="card">
          <div class="card-body flex items-center gap-3 text-sm text-content-muted">
            <app-spinner [size]="20" />
            <span>Cargando catálogos…</span>
          </div>
        </div>
      } @else if (errorMsg() && assignments().length === 0 && !listLoading()) {
        <div class="alert alert-danger" role="alert">
          <app-icon name="alert-circle" [size]="18" />
          <p class="text-sm">{{ errorMsg() }}</p>
          <button type="button" class="btn btn-ghost btn-sm" (click)="reloadAssignments()">
            Reintentar
          </button>
        </div>
      } @else if (listLoading()) {
        <div class="card">
          <div class="card-body flex items-center gap-3 text-sm text-content-muted">
            <app-spinner [size]="20" />
            <span>Cargando asignaciones…</span>
          </div>
        </div>
      } @else if (assignments().length === 0) {
        <section class="card">
          <div class="card-body">
            <app-empty-state
              icon="clipboard-check"
              title="Sin asignaciones"
              [description]="emptyDescription()"
            />
          </div>
        </section>
      } @else {
        <p class="mb-3 text-sm text-content-muted">
          {{ assignments().length }}
          {{ assignments().length === 1 ? 'asignación' : 'asignaciones' }}
        </p>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
          @for (row of assignments(); track row.publicUuid) {
            <button
              type="button"
              role="listitem"
              class="card w-full cursor-pointer border-l-4 text-left transition hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              [style.background]="cardBg(row)"
              [style.border-left-color]="cardBorder(row)"
              (click)="openAssignment(row)"
            >
              <div class="card-body space-y-2">
                <div class="flex items-center gap-2.5">
                  <span
                    class="flex size-9 shrink-0 items-center justify-center rounded-lg"
                    [style.background-color]="avatarBg(row)"
                    [style.color]="visual(row).color"
                    aria-hidden="true"
                  >
                    <app-icon [name]="visual(row).icon" [size]="18" />
                  </span>
                  <p
                    class="text-xs font-semibold uppercase tracking-wide"
                    [style.color]="visual(row).color"
                  >
                    {{ row.courseCode || 'Curso' }}
                  </p>
                </div>
                <h2 class="text-lg font-semibold text-content">{{ row.courseName }}</h2>
                <p class="text-sm text-content-muted">
                  {{ sectionLabelFor(row) }}
                </p>
                <p class="text-sm text-content">{{ row.teacherFullName }}</p>
                <p class="pt-1 text-xs font-semibold uppercase tracking-wide text-content-muted">
                  Abrir registros
                </p>
              </div>
            </button>
          }
        </div>
      }
    </app-page-container>
  `,
})
export class EvaluationsAdminPickerComponent implements OnInit {
  private readonly academicApi = inject(AcademicApiService);
  private readonly teachersApi = inject(TeachersApiService);
  private readonly sectionContext = inject(LmsSectionContextService);
  private readonly router = inject(Router);

  readonly teachersRoute = ROUTES.TEACHERS.ROOT;

  readonly catalogLoading = signal(true);
  readonly listLoading = signal(false);
  readonly errorMsg = signal<string | null>(null);

  readonly periods = signal<AcademicPeriodRow[]>([]);
  readonly sections = signal<SectionRow[]>([]);
  readonly courses = signal<CourseRow[]>([]);
  readonly teachers = signal<{ publicUuid: string; fullName: string }[]>([]);
  readonly assignments = signal<AssignmentRow[]>([]);

  readonly periodId = signal('');
  readonly sectionId = signal('');
  readonly courseId = signal('');
  readonly teacherId = signal('');

  private readonly sectionByUuid = signal<Map<string, SectionRow>>(new Map());

  readonly emptyDescription = computed(() => {
    if (this.periodId() || this.sectionId() || this.courseId() || this.teacherId()) {
      return 'No hay asignaciones activas con estos filtros. Prueba ampliar periodo, sección o curso.';
    }
    return 'Aún no hay asignaciones docentes activas en el colegio. Crea asignaciones desde Docentes.';
  });

  ngOnInit(): void {
    void this.#boot();
  }

  periodLabel(period: AcademicPeriodRow): string {
    return formatPeriodLabel(period);
  }

  sectionLabel(section: SectionRow): string {
    return formatSectionDisplayLabel(section.name, section.gradeName);
  }

  sectionLabelFor(row: AssignmentRow): string {
    const section = this.sectionByUuid().get(row.sectionPublicUuid);
    if (section) return this.sectionLabel(section);
    return row.sectionName;
  }

  onPeriodChange(value: string): void {
    this.periodId.set(value);
    void this.reloadAssignments();
  }

  onSectionChange(value: string): void {
    this.sectionId.set(value);
    void this.reloadAssignments();
  }

  onCourseChange(value: string): void {
    this.courseId.set(value);
    void this.reloadAssignments();
  }

  onTeacherChange(value: string): void {
    this.teacherId.set(value);
    void this.reloadAssignments();
  }

  openAssignment(row: AssignmentRow): void {
    void this.router.navigateByUrl(this.sectionContext.evaluationsUrlForAssignment(row));
  }

  visual(row: AssignmentRow): { icon: IconName; color: string } {
    return resolveCourseVisual(row.courseCode, row.courseColor, row.courseIcon);
  }

  cardBg(row: AssignmentRow): string {
    return courseTintBg(this.visual(row).color);
  }

  cardBorder(row: AssignmentRow): string {
    return courseTintBorder(this.visual(row).color);
  }

  avatarBg(row: AssignmentRow): string {
    return courseTintAvatarBg(this.visual(row).color);
  }

  async reloadAssignments(): Promise<void> {
    this.listLoading.set(true);
    this.errorMsg.set(null);
    try {
      const rows = await firstValueFrom(
        this.teachersApi.listTenantAssignments({
          periodId: this.periodId() || undefined,
          sectionId: this.sectionId() || undefined,
          courseId: this.courseId() || undefined,
          teacherId: this.teacherId() || undefined,
          active: true,
        }),
      );
      this.assignments.set(rows);
    } catch {
      this.assignments.set([]);
      this.errorMsg.set('No pudimos cargar las asignaciones del colegio.');
    } finally {
      this.listLoading.set(false);
    }
  }

  async #boot(): Promise<void> {
    this.catalogLoading.set(true);
    this.errorMsg.set(null);
    try {
      const years = await firstValueFrom(this.academicApi.listYears());
      const activeYear = years.find((y) => y.status === AcademicYearStatus.Active) ?? null;

      const [periods, sections, courses, teachersPage] = await Promise.all([
        activeYear
          ? firstValueFrom(
              this.academicApi.listPeriods({ academicYearPublicUuid: activeYear.publicUuid }),
            )
          : Promise.resolve([] as AcademicPeriodRow[]),
        activeYear
          ? firstValueFrom(
              this.academicApi.listSections({ academicYearPublicUuid: activeYear.publicUuid }),
            )
          : firstValueFrom(this.academicApi.listSections()),
        firstValueFrom(this.academicApi.listCourses({ isActive: true })),
        firstValueFrom(
          this.teachersApi.list(
            { employmentStatus: EmploymentStatus.Active },
            { page: 0, size: 200, sort: 'lastName,ASC' },
          ),
        ),
      ]);

      this.periods.set(periods);
      this.sections.set(
        [...sections].sort((a, b) =>
          this.sectionLabel(a).localeCompare(this.sectionLabel(b), 'es'),
        ),
      );
      this.sectionByUuid.set(new Map(sections.map((s) => [s.publicUuid, s])));
      this.courses.set(
        [...courses].sort((a, b) => a.name.localeCompare(b.name, 'es')),
      );
      this.teachers.set(
        teachersPage.content.map((t) => ({
          publicUuid: t.publicUuid,
          fullName: t.fullName,
        })),
      );

      const current = resolveCurrentAcademicPeriod(periods);
      if (current) this.periodId.set(current.publicUuid);
    } catch {
      this.errorMsg.set('No pudimos cargar los catálogos académicos.');
    } finally {
      this.catalogLoading.set(false);
    }

    await this.reloadAssignments();
  }
}
