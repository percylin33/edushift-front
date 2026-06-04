import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards';
import { Permission } from '@core/enums';

export const STUDENTS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permissions: [Permission.StudentsRead], title: 'Estudiantes' },
    loadComponent: () =>
      import('./pages/students-list/students-list.component').then((m) => m.StudentsListComponent)
  },
  {
    path: ':id',
    canActivate: [permissionGuard],
    data: { permissions: [Permission.StudentsRead], breadcrumb: 'Detalle', title: 'Estudiante' },
    loadComponent: () =>
      import('./pages/student-detail/student-detail.component').then((m) => m.StudentDetailComponent)
  }
];
