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
    path: '',
    canActivate: [roleGuard],
    data: { roles: [UserRole.TenantAdmin], title: 'Académico' },
    loadComponent: () =>
      import('./pages/academic-shell/academic-shell.component').then(
        (m) => m.AcademicShellComponent
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'years'
      },
      {
        path: 'years',
        canActivate: [roleGuard],
        data: { roles: [UserRole.TenantAdmin], title: 'Años académicos' },
        loadComponent: () =>
          import('./pages/years-list/years-list.component').then(
            (m) => m.YearsListComponent
          )
      },
      {
        path: 'years/new',
        canActivate: [roleGuard],
        data: {
          roles: [UserRole.TenantAdmin],
          breadcrumb: 'Nuevo',
          title: 'Nuevo año académico'
        },
        loadComponent: () =>
          import('./pages/year-form/year-form.component').then(
            (m) => m.YearFormComponent
          )
      },
      {
        path: 'years/:id/edit',
        canActivate: [roleGuard],
        data: {
          roles: [UserRole.TenantAdmin],
          breadcrumb: 'Editar',
          title: 'Editar año académico'
        },
        loadComponent: () =>
          import('./pages/year-form/year-form.component').then(
            (m) => m.YearFormComponent
          )
      },
      {
        path: 'levels',
        canActivate: [roleGuard],
        data: { roles: [UserRole.TenantAdmin], title: 'Niveles y grados' },
        loadComponent: () =>
          import('./pages/levels-board/levels-board.component').then(
            (m) => m.LevelsBoardComponent
          )
      },
      {
        path: 'sections',
        canActivate: [roleGuard],
        data: { roles: [UserRole.TenantAdmin], title: 'Secciones' },
        loadComponent: () =>
          import('./pages/sections-list/sections-list.component').then(
            (m) => m.SectionsListComponent
          )
      },
      {
        path: 'sections/:id',
        canActivate: [roleGuard],
        data: {
          roles: [UserRole.TenantAdmin],
          breadcrumb: 'Detalle',
          title: 'Detalle de sección'
        },
        loadComponent: () =>
          import('./pages/section-detail/section-detail.component').then(
            (m) => m.SectionDetailComponent
          )
      },
      {
        path: 'courses',
        canActivate: [roleGuard],
        data: { roles: [UserRole.TenantAdmin], title: 'Cursos' },
        loadComponent: () =>
          import('./pages/courses-list/courses-list.component').then(
            (m) => m.CoursesListComponent
          )
      },
      {
        path: 'periods',
        canActivate: [roleGuard],
        data: { roles: [UserRole.TenantAdmin], title: 'Periodos' },
        loadComponent: () =>
          import('./pages/periods-list/periods-list.component').then(
            (m) => m.PeriodsListComponent
          )
      }
    ]
  }
];
