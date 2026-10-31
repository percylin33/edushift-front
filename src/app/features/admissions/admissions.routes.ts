import { pendingChangesGuard } from '@shared/services/form-protection.service';
import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards';
import { Permission, UserRole } from '@core/enums';

const read = [Permission.LmsAdmissionManage, Permission.AdmissionsApplicationsRead];
const manage = [Permission.LmsAdmissionManage, Permission.AdmissionsApplicationsManage];
const applications = () => import('./pages/admissions-list.page').then((m) => m.AdmissionsPageComponent);
const inquiries = () =>
  import('./pages/admissions-inquiries-list.page').then((m) => m.AdmissionsInquiriesPageComponent);
export const ADMISSIONS_ROUTES: Routes = [
  { path: 'presential', redirectTo: 'new', pathMatch: 'full' },
  {
    path: 'new',
    canDeactivate: [pendingChangesGuard],
    canMatch: [permissionGuard],
    data: {
      roles: [UserRole.TenantAdmin],
      permissions: manage,
      title: 'Nueva solicitud',
      creation: true,
    },
    loadComponent: inquiries,
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'applications/:applicationUuid',
    canMatch: [permissionGuard],
    data: {
      roles: [UserRole.TenantAdmin],
      permissions: read,
      title: 'Expediente de admisión',
      view: 'detail',
    },
    loadComponent: applications,
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'applications',
    canMatch: [permissionGuard],
    data: {
      roles: [UserRole.TenantAdmin],
      permissions: read,
      title: 'Solicitudes',
      view: 'applications',
    },
    loadComponent: applications,
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'vacancies',
    canMatch: [permissionGuard],
    data: {
      roles: [UserRole.TenantAdmin],
      permissions: read,
      title: 'Vacantes',
      view: 'vacancies',
    },
    loadComponent: applications,
  },
  {
    path: 'inquiries',
    canDeactivate: [pendingChangesGuard],
    canMatch: [permissionGuard],
    data: {
      roles: [UserRole.TenantAdmin],
      permissions: [Permission.LmsAdmissionManage, Permission.AdmissionsInquiriesRead],
      title: 'Consultas',
    },
    loadComponent: inquiries,
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: '',
    pathMatch: 'full',
    canMatch: [permissionGuard],
    data: {
      roles: [UserRole.TenantAdmin],
      permissions: [...read, Permission.AdmissionsInquiriesRead, ...manage],
      title: 'Admisiones',
      view: 'overview',
    },
    loadComponent: applications,
  },
];
