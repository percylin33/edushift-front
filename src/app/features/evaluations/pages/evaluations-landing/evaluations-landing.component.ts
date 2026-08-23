import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { UserRole } from '@core/enums';
import { AuthService } from '@core/services';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
} from '@shared/components';

/**
 * `/evaluations` — landing page (FE-5B.6).
 *
 * <p>Per ADR-5B.2 the evaluations module is scoped to a
 * {@code TeacherAssignment}; there is no global listing. This screen
 * exists so that the sidebar item resolves to something useful
 * instead of a blank {@code <router-outlet/>} (BUG-2026-07-30-04).</p>
 *
 * <p>From here the user can drill into the per-assignment list, which
 * already has the full filter / create / lifecycle UX.</p>
 */
@Component({
  selector: 'app-evaluations-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    EmptyStateComponent,
    IconComponent,
    PageContainerComponent,
    PageHeaderComponent,
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header
        eyebrow="Evaluaciones"
        title="Evaluaciones"
        subtitle="Las evaluaciones viven dentro de cada asignación de un docente."
      />

      <section class="card">
        <div class="card-body space-y-6">
          <p class="text-sm text-content-muted">
            EduShift no expone un listado global de evaluaciones. Para
            revisarlas, calificar o crear nuevas, abre la asignación de
            la materia correspondiente.
          </p>

          <div class="grid gap-3 sm:grid-cols-2">
            <a
              [routerLink]="teachersRoute"
              class="group flex items-start gap-3 rounded-lg border border-border-subtle p-4 transition-colors hover:border-primary-500 hover:bg-surface-muted"
            >
              <span
                class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-500/10 text-primary-600"
              >
                <app-icon name="users" [size]="18" />
              </span>
              <span class="flex-1">
                <span class="block text-sm font-semibold text-content">
                  Ir a Docentes
                </span>
                <span class="mt-1 block text-xs text-content-muted">
                  Selecciona un docente y luego una de sus asignaciones para
                  ver sus evaluaciones.
                </span>
              </span>
              <app-icon
                name="chevron-right"
                [size]="16"
                class="mt-1 text-content-subtle transition-transform group-hover:translate-x-0.5"
              />
            </a>

            @if (canUseLms()) {
              <a
                [routerLink]="lmsRoute"
                class="group flex items-start gap-3 rounded-lg border border-border-subtle p-4 transition-colors hover:border-primary-500 hover:bg-surface-muted"
              >
                <span
                  class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-500/10 text-primary-600"
                >
                  <app-icon name="book-open" [size]="18" />
                </span>
                <span class="flex-1">
                  <span class="block text-sm font-semibold text-content">
                    Ir a Mis cursos
                  </span>
                  <span class="mt-1 block text-xs text-content-muted">
                    Vista rápida de LMS con materiales y tareas por sección.
                  </span>
                </span>
                <app-icon
                  name="chevron-right"
                  [size]="16"
                  class="mt-1 text-content-subtle transition-transform group-hover:translate-x-0.5"
                />
              </a>
            }
          </div>

          <app-empty-state
            icon="clipboard-check"
            title="Sin listado global"
            description="Las evaluaciones se gestionan dentro de cada asignación. Esto es por diseño (ADR-5B.2)."
          />
        </div>
      </section>
    </app-page-container>
  `,
})
export class EvaluationsLandingComponent {
  private readonly auth = inject(AuthService);

  readonly teachersRoute = ROUTES.TEACHERS.ROOT;
  readonly lmsRoute = ROUTES.LMS.ROOT;

  readonly canUseLms = computed(() => {
    const roles = this.auth.roles();
    return roles.includes(UserRole.TenantAdmin) || roles.includes(UserRole.Teacher);
  });
}
