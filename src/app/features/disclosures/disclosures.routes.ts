import { pendingChangesGuard } from '@shared/services/form-protection.service';
import { Routes } from '@angular/router';
import { permissionGuard, roleGuard } from '@core/guards';
import { Permission, UserRole } from '@core/enums';

export const DISCLOSURES_ROUTES: Routes = [
  {
    canDeactivate: [pendingChangesGuard],
    path: '',
    canActivate: [roleGuard, permissionGuard],
    data: {
      roles: [UserRole.TenantAdmin, UserRole.Staff],
      permissions: Permission.LmsDisclosureRead,
      title: 'Información anual',
    },
    loadComponent: () =>
      import('./pages/disclosure-workspace.page').then((module) => module.DisclosureWorkspacePage),
  },
];
