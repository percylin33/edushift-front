import { pendingChangesGuard } from '@shared/services/form-protection.service';
import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards';
import { Permission } from '@core/enums';

export const AI_ROUTES: Routes = [
  {
    canDeactivate: [pendingChangesGuard],
    path: '',
    canMatch: [permissionGuard],
    data: { permissions: [
      Permission.LmsAiGenerate, Permission.AiTutorUse,
      Permission.AiTeacherUse, Permission.AiFamilyUse,
    ], mode: 'any' },
    loadComponent: () => import('./pages/ai-home/ai-home.component').then((m) => m.AiHomeComponent),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'tutor',
    canMatch: [permissionGuard],
    data: { permissions: Permission.AiTutorUse, mode: 'any' },
    loadComponent: () => import('./pages/agent-chat/agent-chat.component').then((m) => m.AgentChatComponent),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'teacher',
    canMatch: [permissionGuard],
    data: { permissions: Permission.AiTeacherUse, mode: 'any' },
    loadComponent: () => import('./pages/agent-chat/agent-chat.component').then((m) => m.AgentChatComponent),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'family',
    canMatch: [permissionGuard],
    data: { permissions: Permission.AiFamilyUse, mode: 'any' },
    loadComponent: () => import('./pages/agent-chat/agent-chat.component').then((m) => m.AgentChatComponent),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'sources',
    canMatch: [permissionGuard],
    data: { permissions: Permission.AiSourceManage, mode: 'any' },
    loadComponent: () => import('./pages/ai-sources/ai-sources.component').then((m) => m.AiSourcesComponent),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'chat',
    canMatch: [permissionGuard],
    data: { permissions: Permission.LmsAiGenerate, mode: 'any' },
    loadComponent: () => import('./pages/chat-page/chat-page.component').then((m) => m.ChatPageComponent),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'insights',
    canMatch: [permissionGuard],
    data: { permissions: Permission.LmsAiUsage, mode: 'any' },
    loadComponent: () => import('./pages/ai-usage-page/ai-usage-page.component').then((m) => m.AiUsagePageComponent),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'usage',
    canMatch: [permissionGuard],
    data: { permissions: Permission.LmsAiUsage, mode: 'any' },
    loadComponent: () => import('./pages/ai-usage-page/ai-usage-page.component').then((m) => m.AiUsagePageComponent),
  },
];
