import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ROUTES } from '@core/constants';
import { UserRole } from '@core/enums';
import { AuthService } from '@core/services';
import {
  EmptyStateComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import { LmsSectionContextService } from '@features/lms/services/lms-section-context.service';
import { EvaluationsAdminPickerComponent } from '../evaluations-admin-picker/evaluations-admin-picker.component';

/**
 * `/evaluations` landing — TENANT_ADMIN ve picker del colegio;
 * TEACHER redirige al funnel (o by-assignment si 1).
 */
@Component({
  selector: 'app-evaluations-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    EmptyStateComponent,
    EvaluationsAdminPickerComponent,
    PageContainerComponent,
    PageHeaderComponent,
    SpinnerComponent,
  ],
  template: `
    @if (showAdminPicker()) {
      <app-evaluations-admin-picker />
    } @else {
      <app-page-container size="wide">
        <app-page-header
          eyebrow="Registros"
          title="Registros"
          [subtitle]="
            noTeacherAssignments()
              ? 'Cuando tengas materias asignadas podrás gestionar registros aquí.'
              : 'Preparando Registros…'
          "
        />

        @if (loading()) {
          <div class="card">
            <div class="card-body flex items-center gap-3 text-sm text-content-muted">
              <app-spinner [size]="20" />
              <span>Preparando Registros…</span>
            </div>
          </div>
        } @else if (errorMsg()) {
          <div class="alert alert-danger" role="alert">
            <p class="text-sm">{{ errorMsg() }}</p>
          </div>
        } @else if (noTeacherAssignments()) {
          <section class="card">
            <div class="card-body">
              <app-empty-state
                icon="clipboard-check"
                title="Sin asignaciones activas"
                description="Aún no tienes materias asignadas. Cuando el administrador te vincule a una sección podrás gestionar registros aquí."
              />
            </div>
          </section>
        }
      </app-page-container>
    }
  `,
})
export class EvaluationsLandingComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly sectionContext = inject(LmsSectionContextService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly errorMsg = signal<string | null>(null);
  readonly noTeacherAssignments = signal(false);
  readonly showAdminPicker = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      const isTeacher = this.auth.hasRole(UserRole.Teacher);
      const isAdmin = this.auth.hasRole(UserRole.TenantAdmin);

      // Admin (con o sin rol TEACHER): picker de todo el colegio.
      if (isAdmin) {
        this.showAdminPicker.set(true);
        this.loading.set(false);
        return;
      }

      if (isTeacher) {
        const assignments = await this.sectionContext.loadCurrentYearAssignments();
        if (assignments.length === 1) {
          await this.router.navigateByUrl(
            this.sectionContext.evaluationsUrlForAssignment(assignments[0]!),
          );
          return;
        }
        if (assignments.length > 1) {
          await this.router.navigateByUrl(ROUTES.EVALUATIONS.COURSES);
          return;
        }
        this.noTeacherAssignments.set(true);
        this.loading.set(false);
        return;
      }

      this.loading.set(false);
      this.errorMsg.set('No tienes permiso para ver Registros.');
    } catch {
      this.loading.set(false);
      this.errorMsg.set('No pudimos cargar tus asignaciones.');
    }
  }
}
