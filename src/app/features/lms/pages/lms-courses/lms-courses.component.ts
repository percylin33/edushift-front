import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { UserRole } from '@core/enums';
import { AuthService } from '@core/services';
import {
  courseTintAvatarBg,
  courseTintBg,
  courseTintBorder,
  resolveCourseVisual,
} from '@features/academic/utils/course-visual.util';
import {
  EmptyStateComponent,
  IconComponent,
  IconName,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import {
  LmsCourseOption,
  LmsSectionContextService,
} from '../../services/lms-section-context.service';

/**
 * Paso 1 del funnel Mis cursos: grilla de materias (TeacherAssignment agrupadas).
 */
@Component({
  selector: 'app-lms-courses',
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
        eyebrow="Mis cursos"
        title="Materias"
        subtitle="Elige una materia para ver las secciones donde la impartes."
      />

      @if (loading()) {
        <div class="card">
          <div class="card-body flex items-center gap-3 text-sm text-content-muted">
            <app-spinner [size]="20" />
            <span>Cargando tus materias…</span>
          </div>
        </div>
      } @else if (courses().length === 0) {
        <section class="card">
          <div class="card-body space-y-4">
            <app-empty-state
              icon="book-open"
              title="Sin asignaciones activas"
              description="Aún no tienes materias asignadas. Cuando el administrador te vincule a una sección podrás gestionar tareas y materiales aquí."
            />
            @if (isAdmin()) {
              <a [routerLink]="academicSectionsRoute" class="btn btn-primary btn-sm self-start">
                <app-icon name="plus" [size]="16" />
                <span>Ir a Académico › Secciones</span>
              </a>
            } @else {
              <a [routerLink]="evaluationsRoute" class="btn btn-ghost btn-sm self-start">
                <app-icon name="clipboard-check" [size]="16" />
                <span>Ir a Registros</span>
              </a>
            }
          </div>
        </section>
      } @else {
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          @for (course of courses(); track course.coursePublicUuid) {
            <a
              role="listitem"
              [routerLink]="courseSectionsLink(course.coursePublicUuid)"
              class="card border-l-4 transition hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              [style.background]="cardBg(course)"
              [style.border-left-color]="cardBorder(course)"
            >
              <div class="card-body space-y-2">
                <div class="flex items-center gap-2.5">
                  <span
                    class="flex size-9 shrink-0 items-center justify-center rounded-lg"
                    [style.background-color]="avatarBg(course)"
                    [style.color]="visual(course).color"
                    aria-hidden="true"
                  >
                    <app-icon [name]="visual(course).icon" [size]="18" />
                  </span>
                  <p
                    class="text-xs font-semibold uppercase tracking-wide"
                    [style.color]="visual(course).color"
                  >
                    {{ course.courseCode || 'Materia' }}
                  </p>
                </div>
                <h2 class="text-lg font-semibold text-content">{{ course.courseName }}</h2>
                <p class="text-sm text-content-muted">
                  {{ course.sectionCount }}
                  {{ course.sectionCount === 1 ? 'sección' : 'secciones' }}
                </p>
              </div>
            </a>
          }
        </div>
      }
    </app-page-container>
  `,
})
export class LmsCoursesComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly sectionContext = inject(LmsSectionContextService);

  readonly academicSectionsRoute = ROUTES.ACADEMIC.SECTIONS.LIST;
  readonly evaluationsRoute = ROUTES.EVALUATIONS.ROOT;

  readonly loading = signal(true);
  readonly courses = signal<LmsCourseOption[]>([]);

  ngOnInit(): void {
    void this.#load();
  }

  isAdmin(): boolean {
    return this.auth.hasRole(UserRole.TenantAdmin);
  }

  courseSectionsLink(courseUuid: string): string {
    return ROUTES.LMS.courseSections(courseUuid);
  }

  visual(course: LmsCourseOption): { icon: IconName; color: string } {
    return resolveCourseVisual(course.courseCode, course.color, course.icon);
  }

  cardBg(course: LmsCourseOption): string {
    return courseTintBg(this.visual(course).color);
  }

  cardBorder(course: LmsCourseOption): string {
    return courseTintBorder(this.visual(course).color);
  }

  avatarBg(course: LmsCourseOption): string {
    return courseTintAvatarBg(this.visual(course).color);
  }

  async #load(): Promise<void> {
    try {
      const assignments = await this.sectionContext.loadMyAssignments();
      this.courses.set(this.sectionContext.groupCoursesFromAssignments(assignments));
    } finally {
      this.loading.set(false);
    }
  }
}
