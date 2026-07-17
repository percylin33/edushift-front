import { Routes } from '@angular/router';
import { authChildGuard } from '@core/guards';
import { permissionGuard } from '@core/guards';
import { Permission } from '@core/enums';

export const AI_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/ai-home/ai-home.component').then((m) => m.AiHomeComponent),
  },
  {
    path: 'chat',
    canMatch: [permissionGuard],
    data: { permissions: Permission.LmsAiGenerate, mode: 'any' },
    loadComponent: () => import('./pages/chat-page/chat-page.component').then((m) => m.ChatPageComponent),
  },
  {
    path: 'insights',
    canActivate: [authChildGuard],
    loadComponent: () => import('./pages/ai-usage-page/ai-usage-page.component').then((m) => m.AiUsagePageComponent),
  },
  {
    path: 'usage',
    canMatch: [permissionGuard],
    data: { permissions: Permission.LmsAiUsage, mode: 'any' },
    loadComponent: () => import('./pages/ai-usage-page/ai-usage-page.component').then((m) => m.AiUsagePageComponent),
  },
];
