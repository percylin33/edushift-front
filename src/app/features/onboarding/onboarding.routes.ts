import { pendingChangesGuard } from '@shared/services/form-protection.service';
import { Routes } from '@angular/router';

/**
 * Multi-step wizard. Mounted under the `OnboardingLayoutComponent` (which
 * provides `OnboardingService` scoped to the layout — the wizard state dies
 * when the user leaves the section).
 */
export const ONBOARDING_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'welcome' },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'welcome',
    data: { title: 'Bienvenido', breadcrumb: 'Bienvenida' },
    loadComponent: () =>
      import('./pages/welcome/welcome.component').then((m) => m.OnboardingWelcomeComponent),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'school',
    data: { title: 'Institución', breadcrumb: 'Institución' },
    loadComponent: () =>
      import('./pages/school/school.component').then((m) => m.OnboardingSchoolComponent),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'complete',
    data: { title: '¡Listo!', breadcrumb: 'Listo' },
    loadComponent: () =>
      import('./pages/complete/complete.component').then((m) => m.OnboardingCompleteComponent),
  },
];
