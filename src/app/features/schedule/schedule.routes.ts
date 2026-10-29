import { pendingChangesGuard } from '@shared/services/form-protection.service';
import { Routes } from '@angular/router';
import { roleGuard } from '@core/guards';
import { UserRole } from '@core/enums';

export const SCHEDULE_ROUTES: Routes = [
	{
		canDeactivate: [pendingChangesGuard],
    path: '',
		pathMatch: 'full',
		loadComponent: () =>
			import('./pages/schedule-page/schedule-page.component').then(
				(m) => m.SchedulePageComponent,
			),
	},
	{
		canDeactivate: [pendingChangesGuard],
    path: 'me',
		loadComponent: () =>
			import('./pages/schedule-page/schedule-page.component').then(
				(m) => m.SchedulePageComponent,
			),
	},
	{
		canDeactivate: [pendingChangesGuard],
		path: 'jornada/:templateUuid',
		canActivate: [roleGuard],
		data: { roles: [UserRole.TenantAdmin], title: 'Detalle de jornada' },
		loadComponent: () =>
			import('./pages/jornada-page/jornada-page.component').then(
				(m) => m.JornadaPageComponent,
			),
	},
	{
		canDeactivate: [pendingChangesGuard],
		path: 'jornada',
		canActivate: [roleGuard],
		data: { roles: [UserRole.TenantAdmin], title: 'Jornada y recreos' },
		loadComponent: () =>
			import('./pages/jornada-page/jornada-page.component').then(
				(m) => m.JornadaPageComponent,
			),
	},
	{
		canDeactivate: [pendingChangesGuard],
    path: 'workload',
		canActivate: [roleGuard],
		data: { roles: [UserRole.TenantAdmin], title: 'Carga docente' },
		loadComponent: () =>
			import('./pages/workload-page/workload-page.component').then(
				(m) => m.WorkloadPageComponent,
			),
	},
];
