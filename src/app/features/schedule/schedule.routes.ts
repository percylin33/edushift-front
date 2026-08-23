import { Routes } from '@angular/router';
import { roleGuard } from '@core/guards';
import { UserRole } from '@core/enums';

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
	{
		path: 'jornada',
		canActivate: [roleGuard],
		data: { roles: [UserRole.TenantAdmin], title: 'Jornada y recreos' },
		loadComponent: () =>
			import('./pages/jornada-page/jornada-page.component').then(
				(m) => m.JornadaPageComponent,
			),
	},
	{
		path: 'workload',
		canActivate: [roleGuard],
		data: { roles: [UserRole.TenantAdmin], title: 'Carga docente' },
		loadComponent: () =>
			import('./pages/workload-page/workload-page.component').then(
				(m) => m.WorkloadPageComponent,
			),
	},
];
