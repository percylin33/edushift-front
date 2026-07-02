import { Routes } from '@angular/router';
import { roleGuard } from '@core/guards';
import { UserRole } from '@core/enums';

/**
 * Routes para el feature {@code rubrics} (Sprint 5B / FE-5B.2).
 *
 * <h3>Estructura</h3>
 * <ul>
 *   <li>{@code /rubrics}                  → list (catálogo + personalizadas).</li>
 *   <li>{@code /rubrics/new}              → form de creación.</li>
 *   <li>{@code /rubrics/:publicUuid}      → detail read-only con matriz criterio × nivel.</li>
 *   <li>{@code /rubrics/:publicUuid/edit} → form de edición (sólo non-system).</li>
 * </ul>
 *
 * <h3>RBAC</h3>
 * <p>Sprint 5B mantiene el módulo gateado a {@code TENANT_ADMIN |
 * TEACHER}; granularidad fina llega con la security sprint. El backend
 * impone {@code @PreAuthorize} per-endpoint — este guard es solo UX
 * hint.</p>
 */
export const RUBRICS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard],
    data: {
      roles: [UserRole.TenantAdmin, UserRole.Teacher],
      title: 'Rúbricas',
    },
    loadComponent: () =>
      import('./pages/rubrics-list/rubrics-list.component').then((m) => m.RubricsListComponent),
  },
  {
    path: 'new',
    canActivate: [roleGuard],
    data: {
      roles: [UserRole.TenantAdmin, UserRole.Teacher],
      breadcrumb: 'Nueva',
      title: 'Nueva rúbrica',
    },
    loadComponent: () =>
      import('./pages/rubric-form/rubric-form.component').then((m) => m.RubricFormComponent),
  },
  {
    path: ':publicUuid',
    canActivate: [roleGuard],
    data: {
      roles: [UserRole.TenantAdmin, UserRole.Teacher],
      breadcrumb: 'Detalle',
      title: 'Detalle de rúbrica',
    },
    loadComponent: () =>
      import('./pages/rubric-detail/rubric-detail.component').then((m) => m.RubricDetailComponent),
  },
  {
    path: ':publicUuid/edit',
    canActivate: [roleGuard],
    data: {
      roles: [UserRole.TenantAdmin, UserRole.Teacher],
      breadcrumb: 'Editar',
      title: 'Editar rúbrica',
    },
    loadComponent: () =>
      import('./pages/rubric-form/rubric-form.component').then((m) => m.RubricFormComponent),
  },
];
