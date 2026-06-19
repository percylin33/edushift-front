import { Routes } from '@angular/router';

export const ANNOUNCEMENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/announcements-page/announcements-page.component').then(
        (m) => m.AnnouncementsPageComponent
      )
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/announcement-composer-page/announcement-composer-page.component').then(
        (m) => m.AnnouncementComposerPageComponent
      )
  }
];
