import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards';
import { Permission } from '@core/enums';

export const FAMILY_ROUTES: Routes = [
  {
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
        path: '',
        loadComponent: () =>
          import('./pages/children-list/family-child-detail.page').then(
            (m) => m.FamilyChildDetailPageComponent,
          ),
      },
      {
        path: 'attendance',
        loadComponent: () =>
          import('./pages/child-attendance/family-child-attendance.page').then(
            (m) => m.FamilyChildAttendancePageComponent,
          ),
      },
      {
        path: 'grades',
        loadComponent: () =>
          import('./pages/child-grades/family-child-grades.page').then(
            (m) => m.FamilyChildGradesPageComponent,
          ),
      },
      {
        path: 'activities',
        loadComponent: () =>
          import('./pages/child-activities/family-child-activities.page').then(
            (m) => m.FamilyChildActivitiesPageComponent,
          ),
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('./pages/child-payments/family-child-payments.page').then(
            (m) => m.FamilyChildPaymentsPageComponent,
          ),
      },
      {
        path: 'schedule',
        loadComponent: () =>
          import('./pages/child-schedule/family-child-schedule.page').then(
            (m) => m.FamilyChildSchedulePageComponent,
          ),
      },
    ],
  },
];
