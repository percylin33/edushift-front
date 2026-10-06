import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { UserRole } from '@core/enums';
import { AuthService } from '@core/services';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import { LmsSectionContextService } from '../../services/lms-section-context.service';

/**
 * `/lms` landing (FE-7a.5 / BUG-2026-07-30-05).
 *
 * <p>Resolution:</p>
 * <ul>
 *   <li>STUDENT → {@code /me/courses}.</li>
 *   <li>PARENT  → {@code /family}.</li>
 *   <li>TEACHER con 1 assignment → aula directa con {@code ?assignment=}.</li>
 *   <li>TEACHER con N assignments → {@code /lms/courses}.</li>
 *   <li>TENANT_ADMIN sin assignments propias → primera sección ACTIVE del tenant.</li>
 *   <li>Sin secciones / assignments → empty state contextual.</li>
 * </ul>
 */
@Component({
  selector: 'app-lms-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
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
        title="Mis cursos"
        subtitle="Cargando…"
      />

      @if (errorMsg(); as msg) {
        <div class="alert alert-danger mb-4" role="alert">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">No pudimos abrir Mis cursos.</p>
            <p class="mt-1 text-xs opacity-80">{{ msg }}</p>
          </div>
        </div>
      } @else if (loading()) {
        <div class="card">
          <div class="card-body flex items-center gap-3 text-sm text-content-muted">
            <app-spinner [size]="20" />
            <span>Preparando tu espacio…</span>
          </div>
        </div>
      } @else if (noTeacherAssignments()) {
        <section class="card">
          <div class="card-body space-y-4">
            <app-empty-state
              icon="book-open"
              title="Sin asignaciones activas"
              description="Aún no tienes materias asignadas. Cuando el administrador te vincule a una sección podrás gestionar tareas y materiales aquí."
            />
            <a [routerLink]="evaluationsRoute" class="btn btn-ghost btn-sm self-start">
              <app-icon name="clipboard-check" [size]="16" />
              <span>Ir a Registros</span>
            </a>
          </div>
        </section>
      } @else if (noSections()) {
        <section class="card">
          <div class="card-body space-y-4">
            <app-empty-state
              icon="book-open"
              title="Aún no hay secciones"
              description="El tenant no tiene secciones activas. Crea la primera desde el módulo Académico."
            />
            <a [routerLink]="academicSectionsRoute" class="btn btn-primary btn-sm self-start">
              <app-icon name="plus" [size]="16" />
              <span>Ir a Académico › Secciones</span>
            </a>
          </div>
        </section>
      }
    </app-page-container>
  `,
})
export class LmsLandingComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly sectionContext = inject(LmsSectionContextService);
  private readonly router = inject(Router);

  readonly academicSectionsRoute = ROUTES.ACADEMIC.SECTIONS.LIST;
  readonly evaluationsRoute = ROUTES.EVALUATIONS.ROOT;

  readonly loading = signal(true);
  readonly errorMsg = signal<string | null>(null);
  readonly noSections = signal(false);
  readonly noTeacherAssignments = signal(false);

  async ngOnInit(): Promise<void> {
    const role = this.auth.roles();

    if (role.includes(UserRole.Student)) {
      await this.router.navigateByUrl('/me/courses');
      return;
    }
    if (role.includes(UserRole.Parent)) {
      await this.router.navigateByUrl('/family');
      return;
    }

    try {
      const isTeacher = this.auth.hasRole(UserRole.Teacher);
      const isAdmin = this.auth.hasRole(UserRole.TenantAdmin);

      if (isTeacher) {
        const assignments = await this.sectionContext.loadMyAssignments();
        if (assignments.length === 1) {
          await this.router.navigateByUrl(
            this.sectionContext.aulaUrlForAssignment(assignments[0]!),
          );
          return;
        }
        if (assignments.length > 1) {
          await this.router.navigateByUrl(ROUTES.LMS.COURSES);
          return;
        }
        // Teacher without assignments: admins fall through to tenant sections.
        if (!isAdmin) {
          this.loading.set(false);
          this.noTeacherAssignments.set(true);
          return;
        }
      }

      const sectionUuid = await this.sectionContext.resolveDefaultSectionUuid();
      if (!sectionUuid) {
        this.loading.set(false);
        this.noSections.set(true);
        return;
      }

      await this.router.navigateByUrl(ROUTES.LMS.sectionAssignments(sectionUuid));
    } catch (err) {
      this.loading.set(false);
      const status =
        err instanceof HttpErrorResponse ? `${err.status} ${err.statusText || ''}`.trim() : '';
      this.errorMsg.set(
        status
          ? `Error ${status} al cargar las secciones.`
          : 'No pudimos cargar las secciones.',
      );
    }
  }
}
