import { Routes } from '@angular/router';
import { roleGuard } from '@core/guards';
import { UserRole } from '@core/enums';

/**
 * Routes para el feature {@code evaluations} (Sprint 5B).
 *
 * <h3>Estructura</h3>
 * <ul>
 *   <li>{@code /evaluations}                                 → 404 (no hay listing global, ADR-5B.2: las evaluations cuelgan de un assignment).</li>
 *   <li>{@code /evaluations/by-assignment/:assignmentUuid}   → list por assignment (FE-5B.1).</li>
 *   <li>{@code /evaluations/by-assignment/:assignmentUuid/gradebook} → grade book matrix (FE-5B.4, no implementada aún).</li>
 *   <li>{@code /evaluations/:publicUuid}                     → detail con tabs (FE-5B.5, no implementada aún).</li>
 *   <li>{@code /evaluations/:publicUuid/grades}              → grade records (FE-5B.3, no implementada aún).</li>
 * </ul>
 *
 * <h3>RBAC</h3>
 * <p>Mismo trade-off que `academic`: el sprint mantiene el módulo
 * gateado a {@code TENANT_ADMIN | TEACHER}. La granularidad
 * `evaluations:*` llega con la security sprint. El backend impone
 * {@code @PreAuthorize("hasAnyRole('TENANT_ADMIN','TEACHER')")} en
 * cada endpoint — este guard es solo UX hint, no perímetro.</p>
 */
export const EVALUATIONS_ROUTES: Routes = [
  {
    path: 'by-assignment/:assignmentUuid/gradebook',
    canActivate: [roleGuard],
    data: {
      roles: [UserRole.TenantAdmin, UserRole.Teacher],
      breadcrumb: 'Libro de calificaciones',
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
    data: {
      roles: [UserRole.TenantAdmin, UserRole.Teacher],
      title: 'Evaluaciones',
    },
    loadComponent: () =>
      import('./pages/evaluations-list/evaluations-list.component').then(
        (m) => m.EvaluationsListComponent,
      ),
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
      title: 'Detalle de evaluación',
    },
    loadComponent: () =>
      import('./pages/evaluation-detail/evaluation-detail.component').then(
        (m) => m.EvaluationDetailComponent,
      ),
  },
];
