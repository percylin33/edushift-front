import { pendingChangesGuard } from '@shared/services/form-protection.service';
import { Routes } from '@angular/router';
import { announcementAuthorGuard } from './announcement-author.guard';

export const ANNOUNCEMENTS_ROUTES: Routes = [
  {
    canDeactivate: [pendingChangesGuard],
    path: '',
    loadComponent: () =>
      import('./pages/announcements-page/announcements-page.component').then(
        (m) => m.AnnouncementsPageComponent,
      ),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'new',
    canActivate: [announcementAuthorGuard],
    loadComponent: () =>
      import('./pages/announcement-composer-page/announcement-composer-page.component').then(
        (m) => m.AnnouncementComposerPageComponent,
      ),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: ':publicUuid/edit',
    canActivate: [announcementAuthorGuard],
    loadComponent: () =>
      import('./pages/announcement-composer-page/announcement-composer-page.component').then(
        (m) => m.AnnouncementComposerPageComponent,
      ),
  },
];
