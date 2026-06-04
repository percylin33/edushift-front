import { Routes } from '@angular/router';

export const ACADEMIC_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/academic-home/academic-home.component').then((m) => m.AcademicHomeComponent)
  }
];
