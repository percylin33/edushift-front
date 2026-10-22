import { pendingChangesGuard } from '@shared/services/form-protection.service';
import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards';
import { Permission } from '@core/enums';

export const FAMILY_ROUTES: Routes = [
  {
    canDeactivate: [pendingChangesGuard],
    path: 'disclosures',
    canMatch: [permissionGuard],
    data: { permissions: Permission.LmsFamilyRead, title: 'Información del colegio' },
    loadComponent: () =>
      import('../disclosures/pages/family-disclosures.page').then(
        (module) => module.FamilyDisclosuresPage,
      ),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: '',
    canMatch: [permissionGuard],
    data: { permissions: Permission.LmsFamilyRead },
    loadComponent: () =>
      import('./pages/children-list/family-children-list.page').then(
        (m) => m.FamilyChildrenListPageComponent,
      ),
  },
  {
    path: 'children/:studentPublicUuid',
    canMatch: [permissionGuard],
    data: { permissions: Permission.LmsFamilyRead },
    children: [
      {
        canDeactivate: [pendingChangesGuard],
    path: '',
        loadComponent: () =>
          import('./pages/children-list/family-child-detail.page').then(
            (m) => m.FamilyChildDetailPageComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'attendance',
        loadComponent: () =>
          import('./pages/child-attendance/family-child-attendance.page').then(
            (m) => m.FamilyChildAttendancePageComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'grades',
        loadComponent: () =>
          import('./pages/child-grades/family-child-grades.page').then(
            (m) => m.FamilyChildGradesPageComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'activities',
        loadComponent: () =>
          import('./pages/child-activities/family-child-activities.page').then(
            (m) => m.FamilyChildActivitiesPageComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'payments',
        loadComponent: () =>
          import('./pages/child-payments/family-child-payments.page').then(
            (m) => m.FamilyChildPaymentsPageComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'schedule',
        loadComponent: () =>
          import('./pages/child-schedule/family-child-schedule.page').then(
            (m) => m.FamilyChildSchedulePageComponent,
          ),
      },
    ],
  },
];
