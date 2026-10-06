import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import {
  AcademicPeriodRow,
  AcademicYearStatus,
  formatPeriodLabel,
  resolveCurrentAcademicPeriod,
} from '@features/academic/models';
import { AcademicApiService } from '@features/academic/services';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import {
  LmsCourseOption,
  LmsCourseSectionOption,
  LmsSectionContextService,
} from '@features/lms/services/lms-section-context.service';

/**
 * Paso 2 del funnel Registros: secciones de una materia.
 */
@Component({
  selector: 'app-evaluations-course-sections',
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
      <div class="mb-4">
        <a [routerLink]="coursesRoute" class="btn btn-ghost btn-sm">
          <app-icon name="arrow-left" [size]="16" />
          <span>Todas las materias</span>
        </a>
      </div>

      <app-page-header
        eyebrow="Registros"
        [title]="course()?.courseName ?? 'Secciones'"
        [subtitle]="
          course()
            ? 'Elige la sección para abrir los registros de esa asignación.'
            : 'Cargando secciones…'
        "
      />

      @if (loading()) {
        <div class="card">
          <div class="card-body flex items-center gap-3 text-sm text-content-muted">
            <app-spinner [size]="20" />
            <span>Cargando secciones…</span>
          </div>
        </div>
      } @else if (!course() || sections().length === 0) {
        <section class="card">
          <div class="card-body space-y-4">
            <app-empty-state
              icon="users"
              title="Sin secciones para esta materia"
              description="No tienes asignaciones activas de esta materia en ninguna sección."
            />
            <a [routerLink]="coursesRoute" class="btn btn-primary btn-sm self-start">
              Volver a materias
            </a>
          </div>
        </section>
      } @else {
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          @for (section of sections(); track section.sectionPublicUuid) {
            <button
              type="button"
              role="listitem"
              class="card w-full cursor-pointer text-left transition hover:border-primary-300 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              (click)="openRegistros(section)"
            >
              <div class="card-body space-y-2">
                <p class="text-xs font-semibold uppercase tracking-wide text-primary-600">
                  Sección
                </p>
                <h2 class="text-lg font-semibold text-content">{{ section.label }}</h2>
                @if (periodLabel(section); as period) {
                  <p class="text-sm text-content-muted">{{ period }}</p>
                }
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
export class EvaluationsCourseSectionsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sectionContext = inject(LmsSectionContextService);
  private readonly academicApi = inject(AcademicApiService);

  readonly coursesRoute = ROUTES.EVALUATIONS.COURSES;

  readonly loading = signal(true);
  readonly course = signal<LmsCourseOption | null>(null);
  readonly sections = signal<LmsCourseSectionOption[]>([]);
  readonly periods = signal<AcademicPeriodRow[]>([]);

  ngOnInit(): void {
    void this.#load();
  }

  periodLabel(section: LmsCourseSectionOption): string | null {
    const match = this.periods().find((p) => p.publicUuid === section.academicPeriodPublicUuid);
    return match ? formatPeriodLabel(match) : null;
  }

  openRegistros(section: LmsCourseSectionOption): void {
    void this.router.navigateByUrl(
      this.sectionContext.evaluationsUrlForAssignment(section.assignmentPublicUuid),
    );
  }

  async #load(): Promise<void> {
    const courseUuid = this.route.snapshot.paramMap.get('courseUuid');
    if (!courseUuid) {
      this.loading.set(false);
      return;
    }

    try {
      const preferredPeriod = await this.#currentPeriodUuid();
      const { course, sections } = await this.sectionContext.sectionsForCourse(
        courseUuid,
        preferredPeriod,
      );

      if (sections.length === 1 && course) {
        this.openRegistros(sections[0]!);
        return;
      }

      this.course.set(course);
      this.sections.set(sections);
    } finally {
      this.loading.set(false);
    }
  }

  async #currentPeriodUuid(): Promise<string | null> {
    try {
      const years = await firstValueFrom(this.academicApi.listYears());
      const activeYear = years.find((y) => y.status === AcademicYearStatus.Active) ?? null;
      if (!activeYear) return null;
      const periods = await firstValueFrom(
        this.academicApi.listPeriods({ academicYearPublicUuid: activeYear.publicUuid }),
      );
      this.periods.set(periods);
      return resolveCurrentAcademicPeriod(periods)?.publicUuid ?? null;
    } catch {
      this.periods.set([]);
      return null;
    }
  }
}
