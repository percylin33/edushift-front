import { pendingChangesGuard } from '@shared/services/form-protection.service';
﻿import { Routes } from '@angular/router';
import { authChildGuard } from '@core/guards';

/**
 * Centro de Pruebas (`/help`) — Family UAT hub.
 *
 * <p>Replaces the Sprint 17 capability wizard with interactive family-test
 * scripts (checklists + in-app links). Legacy QA / walkthrough / pilot /
 * manuals paths redirect to the hub.</p>
 */
export const HELP_ROUTES: Routes = [
  {
    path: '',
    canActivateChild: [authChildGuard],
    children: [
      {
        canDeactivate: [pendingChangesGuard],
    path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./pages/family-uat-hub/family-uat-hub-page.component').then(
            (m) => m.FamilyUatHubPageComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'script/:roleKey',
        loadComponent: () =>
          import('./pages/family-uat-script/family-uat-script-page.component').then(
            (m) => m.FamilyUatScriptPageComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'lead',
        pathMatch: 'full',
        loadComponent: () =>
          import('./pages/family-uat-lead/family-uat-lead-page.component').then(
            (m) => m.FamilyUatLeadPageComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'reports',
        loadComponent: () =>
          import('./pages/qa-report/qa-report-page.component').then(
            (m) => m.QaReportPageComponent,
          ),
      },
      // Legacy Centro de Pruebas surfaces → hub
      { path: 'role', pathMatch: 'full', redirectTo: '' },
      { path: 'role/:roleKey', redirectTo: '' },
      { path: 'role/:roleKey/:capId', redirectTo: '' },
      { path: 'pilot-guide', pathMatch: 'full', redirectTo: '' },
      { path: 'guides', pathMatch: 'full', redirectTo: '' },
      { path: 'guides/:roleKey', redirectTo: '' },
      { path: 'legacy', pathMatch: 'full', redirectTo: '' },
      { path: 'legacy/:role', redirectTo: '' },
      { path: 'legacy/:role/:chapter', redirectTo: '' },
    ],
  },
];
