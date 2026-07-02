import { Routes } from '@angular/router';

export const AI_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/ai-home/ai-home.component').then((m) => m.AiHomeComponent),
  },
];
