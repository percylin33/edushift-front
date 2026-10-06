import { Routes } from '@angular/router';
import { announcementAuthorGuard } from './announcement-author.guard';

export const ANNOUNCEMENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/announcements-page/announcements-page.component').then(
        (m) => m.AnnouncementsPageComponent,
      ),
  },
  {
    path: 'new',
    canActivate: [announcementAuthorGuard],
    loadComponent: () =>
      import('./pages/announcement-composer-page/announcement-composer-page.component').then(
        (m) => m.AnnouncementComposerPageComponent,
      ),
  },
  {
    path: ':publicUuid/edit',
    canActivate: [announcementAuthorGuard],
    loadComponent: () =>
      import('./pages/announcement-composer-page/announcement-composer-page.component').then(
        (m) => m.AnnouncementComposerPageComponent,
      ),
  },
];
