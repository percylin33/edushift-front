import { Routes } from '@angular/router';
import { roleGuard } from '@core/guards';
import { UserRole } from '@core/enums';
import {
  evaluationsAssignmentBreadcrumbsResolver,
  evaluationsCourseNameResolver,
} from './resolvers/evaluations-breadcrumb.resolvers';

/**
 * Routes para el feature {@code evaluations} (Sprint 5B).
 *
 * <h3>Estructura</h3>
 * <ul>
 *   <li>{@code /evaluations}                                 → admin picker / teacher redirect.</li>
 *   <li>{@code /evaluations/courses}                         → grilla materias (funnel).</li>
 *   <li>{@code /evaluations/courses/:courseUuid/sections}    → grilla secciones.</li>
 *   <li>{@code /evaluations/by-assignment/:assignmentUuid}   → list por assignment (shell).</li>
 *   <li>{@code /evaluations/by-assignment/:assignmentUuid/gradebook} → grade book.</li>
 *   <li>{@code /evaluations/:publicUuid}                     → detail.</li>
 *   <li>{@code /evaluations/:publicUuid/grades}              → grade records.</li>
 * </ul>
 */
export const EVALUATIONS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [roleGuard],
    data: {
      roles: [UserRole.TenantAdmin, UserRole.Teacher],
      title: 'Registros',
    },
    loadComponent: () =>
      import('./pages/evaluations-landing/evaluations-landing.component').then(
        (m) => m.EvaluationsLandingComponent,
      ),
  },
  {
    path: 'courses',
    canActivate: [roleGuard],
    data: {
      roles: [UserRole.TenantAdmin, UserRole.Teacher],
      title: 'Materias',
    },
    loadComponent: () =>
      import('./pages/evaluations-courses/evaluations-courses.component').then(
        (m) => m.EvaluationsCoursesComponent,
      ),
  },
  {
    path: 'courses/:courseUuid/sections',
    canActivate: [roleGuard],
    resolve: { breadcrumb: evaluationsCourseNameResolver },
    data: {
      roles: [UserRole.TenantAdmin, UserRole.Teacher],
      title: 'Secciones',
    },
    loadComponent: () =>
      import('./pages/evaluations-course-sections/evaluations-course-sections.component').then(
        (m) => m.EvaluationsCourseSectionsComponent,
      ),
  },
  {
    path: '',
    canActivate: [roleGuard],
    data: {
      roles: [UserRole.TenantAdmin, UserRole.Teacher],
      title: 'Registros',
    },
    loadComponent: () =>
      import('./pages/evaluations-shell/evaluations-shell.component').then(
        (m) => m.EvaluationsShellComponent,
      ),
    children: [
      {
        path: 'by-assignment/:assignmentUuid/gradebook',
        canActivate: [roleGuard],
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        resolve: { breadcrumbs: evaluationsAssignmentBreadcrumbsResolver },
        data: {
          roles: [UserRole.TenantAdmin, UserRole.Teacher],
          title: 'Libro de calificaciones',
        },
        loadComponent: () =>
          import('@features/gradebook/pages/gradebook-page/gradebook-page.component').then(
            (m) => m.GradeBookPageComponent,
          ),
      },
      {
        path: 'by-assignment/:assignmentUuid',
        canActivate: [roleGuard],
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        resolve: { breadcrumbs: evaluationsAssignmentBreadcrumbsResolver },
        data: {
          roles: [UserRole.TenantAdmin, UserRole.Teacher],
          title: 'Registros',
        },
        loadComponent: () =>
          import('./pages/evaluations-list/evaluations-list.component').then(
            (m) => m.EvaluationsListComponent,
          ),
      },
    ],
  },
  {
    path: ':publicUuid/grades',
    canActivate: [roleGuard],
    data: {
      roles: [UserRole.TenantAdmin, UserRole.Teacher],
      breadcrumb: 'Notas',
      title: 'Calificaciones',
    },
    loadComponent: () =>
      import('@features/grade-records/pages/grade-records-page/grade-records-page.component').then(
        (m) => m.GradeRecordsPageComponent,
      ),
  },
  {
    path: ':publicUuid',
    canActivate: [roleGuard],
    data: {
      roles: [UserRole.TenantAdmin, UserRole.Teacher],
      breadcrumb: 'Detalle',
      title: 'Detalle de registro',
    },
    loadComponent: () =>
      import('./pages/evaluation-detail/evaluation-detail.component').then(
        (m) => m.EvaluationDetailComponent,
      ),
  },
];
