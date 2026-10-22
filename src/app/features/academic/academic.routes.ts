import { pendingChangesGuard } from '@shared/services/form-protection.service';
import { Routes } from '@angular/router';
import { roleGuard } from '@core/guards';
import { UserRole } from '@core/enums';

/**
 * Routes para el módulo {@code academic}.
 *
 * <h3>Estructura (Sprint 4)</h3>
 * <ul>
 *   <li>{@code /academic}                  → redirect a {@code /academic/years} (default tab).</li>
 *   <li>{@code /academic/years}            → listado + activate.</li>
 *   <li>{@code /academic/years/new}        → form de creación.</li>
 *   <li>{@code /academic/years/:id/edit}   → form de edición (mismo componente).</li>
 * </ul>
 *
 * <p>FE-4.2..4.5 montarán las rutas de levels/sections/courses/periods
 * sobre este mismo árbol siguiendo el patrón de {@code years}. Cuando
 * eso ocurra, el {@code AcademicShellComponent} pasará a renderizar
 * tabs persistentes en lugar de redirigir.</p>
 *
 * <h3>RBAC</h3>
 * Mismo trade-off que {@code STUDENTS_ROUTES}: Sprint 4 mantiene el
 * módulo gateado a {@code TENANT_ADMIN}. La granularidad
 * {@code academic:*} llega con el sprint de seguridad. El backend
 * impone {@code @PreAuthorize("hasRole('TENANT_ADMIN')")} — este
 * guard es solo UX hint, no perímetro.
 */
export const ACADEMIC_ROUTES: Routes = [
  {
    canDeactivate: [pendingChangesGuard],
    path: '',
    canActivate: [roleGuard],
    data: { roles: [UserRole.TenantAdmin], title: 'Académico' },
    loadComponent: () =>
      import('./pages/academic-shell/academic-shell.component').then(
        (m) => m.AcademicShellComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'years',
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'years',
        canActivate: [roleGuard],
        data: { roles: [UserRole.TenantAdmin], title: 'Años académicos' },
        loadComponent: () =>
          import('./pages/years-list/years-list.component').then((m) => m.YearsListComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'years/new',
        canActivate: [roleGuard],
        data: {
          roles: [UserRole.TenantAdmin],
          breadcrumb: 'Nuevo',
          title: 'Nuevo año académico',
        },
        loadComponent: () =>
          import('./pages/year-form/year-form.component').then((m) => m.YearFormComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'years/transition',
        canActivate: [roleGuard],
        data: {
          roles: [UserRole.TenantAdmin],
          breadcrumb: 'Preparar siguiente año',
          title: 'Preparar siguiente año',
        },
        loadComponent: () =>
          import('./pages/year-transition/year-transition.component').then(
            (m) => m.YearTransitionComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'years/:id/edit',
        canActivate: [roleGuard],
        data: {
          roles: [UserRole.TenantAdmin],
          breadcrumb: 'Editar',
          title: 'Editar año académico',
        },
        loadComponent: () =>
          import('./pages/year-form/year-form.component').then((m) => m.YearFormComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'levels',
        canActivate: [roleGuard],
        data: { roles: [UserRole.TenantAdmin], title: 'Niveles y grados' },
        loadComponent: () =>
          import('./pages/levels-board/levels-board.component').then((m) => m.LevelsBoardComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'sections',
        canActivate: [roleGuard],
        data: { roles: [UserRole.TenantAdmin], title: 'Secciones' },
        loadComponent: () =>
          import('./pages/sections-list/sections-list.component').then(
            (m) => m.SectionsListComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'sections/:id',
        canActivate: [roleGuard],
        data: {
          roles: [UserRole.TenantAdmin],
          breadcrumb: 'Detalle',
          title: 'Detalle de sección',
        },
        loadComponent: () =>
          import('./pages/section-detail/section-detail.component').then(
            (m) => m.SectionDetailComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'courses',
        canActivate: [roleGuard],
        data: { roles: [UserRole.TenantAdmin], title: 'Cursos' },
        loadComponent: () =>
          import('./pages/courses-list/courses-list.component').then((m) => m.CoursesListComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'courses/:id',
        canActivate: [roleGuard],
        data: {
          roles: [UserRole.TenantAdmin],
          breadcrumb: 'Detalle',
          title: 'Detalle de curso',
        },
        loadComponent: () =>
          import('./pages/course-detail/course-detail.component').then(
            (m) => m.CourseDetailComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'periods',
        canActivate: [roleGuard],
        data: { roles: [UserRole.TenantAdmin], title: 'Periodos' },
        loadComponent: () =>
          import('./pages/periods-list/periods-list.component').then((m) => m.PeriodsListComponent),
      },
      /*
       * Sprint cierre-C / B4 -- physical classrooms catalog. La página
       * reusa el patrón de payment-concepts (cierre-C / F14): tabla +
       * drawer inline para create/edit + confirmación de delete.
       */
      {
        canDeactivate: [pendingChangesGuard],
    path: 'classrooms',
        canActivate: [roleGuard],
        data: { roles: [UserRole.TenantAdmin], title: 'Aulas' },
        loadComponent: () =>
          import('./pages/classrooms-page/classrooms-page.component').then(
            (m) => m.ClassroomsPageComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'grade-register',
        canActivate: [roleGuard],
        data: { roles: [UserRole.TenantAdmin], title: 'Registro de notas' },
        loadComponent: () =>
          import('./pages/grade-register-page/grade-register-page.component').then(
            (m) => m.GradeRegisterPageComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'grade-register/settings',
        canActivate: [roleGuard],
        data: {
          roles: [UserRole.TenantAdmin],
          title: 'Configuración del registro',
          view: 'settings',
        },
        loadComponent: () =>
          import('./pages/grade-register-page/grade-register-page.component').then(
            (m) => m.GradeRegisterPageComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'session-templates',
        canActivate: [roleGuard],
        data: { roles: [UserRole.TenantAdmin], title: 'Plantillas de sesión' },
        loadComponent: () =>
          import('./pages/session-templates-page/session-templates-page.component').then(
            (m) => m.SessionTemplatesPageComponent,
          ),
      },
    ],
  },
];
