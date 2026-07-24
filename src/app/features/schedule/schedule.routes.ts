import { Routes } from '@angular/router';
import { SchedulePageComponent } from './pages/schedule-page/schedule-page.component';

export const SCHEDULE_ROUTES: Routes = [
	{
		path: '',
		pathMatch: 'full',
		loadComponent: () =>
			import('./pages/schedule-page/schedule-page.component').then(
				(m) => m.SchedulePageComponent,
			),
	},
	{
		path: 'me',
		loadComponent: () =>
			import('./pages/schedule-page/schedule-page.component').then(
				(m) => m.SchedulePageComponent,
			),
	},
];