import { Routes } from '@angular/router';
import { authChildGuard } from '@core/guards';

/**
 * Centro de Pruebas (`/help`) â€” Sprint 17 / F-QA-PLAN 2026-07-17.
 *
 * <p>Replaces the legacy manual grid with a role-based QA wizard.</p>
 *
 * <h3>Routes</h3>
 * <ul>
 *   <li>{@code /help} â€” overview grid (one card per role).</li>
 *   <li>{@code /help/role/:roleKey} â€” capability grid for one role.</li>
 *   <li>{@code /help/role/:roleKey/:capId} â€” wizard for one capability.</li>
 *   <li>{@code /help/reports} â€” list of bug reports.</li>
 *   <li>{@code /help/legacy* â€” markdown manuals, retained for backwards compat.</li>
 * </ul>
 */
export const HELP_ROUTES: Routes = [
  {
    path: '',
    canActivateChild: [authChildGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./pages/qa-overview/qa-overview-page.component').then(
            (m) => m.QaOverviewPageComponent,
          ),
      },
      {
        path: 'role/:roleKey',
        loadComponent: () =>
          import('./pages/qa-role-plan/qa-role-plan-page.component').then(
            (m) => m.QaRolePlanPageComponent,
          ),
      },
      {
        path: 'role/:roleKey/:capId',
        loadComponent: () =>
          import('./pages/qa-wizard/qa-wizard-page.component').then(
            (m) => m.QaWizardPageComponent,
          ),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./pages/qa-report/qa-report-page.component').then(
            (m) => m.QaReportPageComponent,
          ),
      },
      {
        path: 'pilot-guide',
        pathMatch: 'full',
        loadComponent: () =>
          import('./pages/pilot-guide/pilot-guide-page.component').then(
            (m) => m.PilotGuidePageComponent,
          ),
      },
      {
        path: 'guides',
        pathMatch: 'full',
        loadComponent: () =>
          import('./pages/walkthrough-index/walkthroughs-index-page.component').then(
            (m) => m.WalkthroughsIndexPageComponent,
          ),
      },
      {
        path: 'guides/:roleKey',
        loadComponent: () =>
          import('./pages/walkthrough-viewer/walkthrough-viewer-page.component').then(
            (m) => m.WalkthroughViewerPageComponent,
          ),
      },
      {
        path: 'legacy',
        pathMatch: 'full',
        loadComponent: () =>
          import('./pages/help-index/help-index-page.component').then(
            (m) => m.HelpIndexPageComponent,
          ),
      },
      {
        path: 'legacy/:role',
        loadComponent: () =>
          import('./pages/help-viewer/help-viewer-page.component').then(
            (m) => m.HelpViewerPageComponent,
          ),
      },
      {
        path: 'legacy/:role/:chapter',
        loadComponent: () =>
          import('./pages/help-viewer/help-viewer-page.component').then(
            (m) => m.HelpViewerPageComponent,
          ),
      },
    ],
  },
];

