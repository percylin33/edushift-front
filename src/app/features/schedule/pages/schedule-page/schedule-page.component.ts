import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	OnInit,
	computed,
	inject,
	signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService, TenantService } from '@core/services';
import { UserRole } from '@core/enums';
import { ROUTES } from '@core/constants';
import {
	EmptyStateComponent,
	IconComponent,
	PageContainerComponent,
	PageHeaderComponent,
	SpinnerComponent,
} from '@shared/components';
import { AcademicApiService } from '@features/academic/services';
import { ScheduleSlotItem } from '@features/academic/models';
import { ScheduleGridComponent } from '@features/academic/components/schedule-grid.component';

/**
 * Sprint cierre-C / F8 — Top-level `/schedule` route.
 *
 * <p>Role-aware landing:
 * <ul>
 *   <li><b>TENANT_ADMIN</b>: a placeholder explaining that the full
 *       tenant schedule is in development, with a deep-link to the
 *       <i>Docentes</i> list (each teacher's detail page already
 *       renders their weekly grid via {@code TeacherScheduleTabComponent}).</li>
 *   <li><b>TEACHER</b>: <i>Mi horario</i> — requires the user's linked
 *       {@code teacherPublicUuid}. For Sprint MVP we route via
 *       {@code /teachers/me} when the teacher link is known, otherwise
 *       we ask the user to pick a teacher from the academic detail page.</li>
 *   <li><b>STUDENT</b>: shows the section's schedule (placeholder for MVP).</li>
 * </ul>
 * </p>
 *
 * <p>The page is intentionally thin because the per-tenant schedule UI
 * (cierre-C / B4) is still in progress; this is the URL plumbing
 * (route + sidebar entry) and the role-aware landing for now.</p>
 */
@Component({
	selector: 'app-schedule-page',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		CommonModule,
		RouterLink,
		PageContainerComponent,
		PageHeaderComponent,
		IconComponent,
		EmptyStateComponent,
		SpinnerComponent,
		ScheduleGridComponent,
	],
	template: `
		<app-page-container size="wide">
			<app-page-header
				eyebrow="Horarios"
				[title]="title()"
				[subtitle]="subtitle()"
			>
				@if (isAdmin()) {
					<a [routerLink]="ROUTES.TEACHERS.LIST" class="btn btn-outline btn-sm">
						<app-icon name="users" [size]="14" />
						<span>Ver docentes</span>
					</a>
				}
				@if (isTeacher()) {
					<a [routerLink]="ROUTES.SCHEDULE.MINE" class="btn btn-primary btn-sm">
						<app-icon name="user" [size]="14" />
						<span>Mi horario</span>
					</a>
				}
			</app-page-header>

			@if (loading()) {
				<div class="flex items-center justify-center py-16">
					<app-spinner [size]="24" label="Cargando horario…" />
				</div>
			} @else if (errorMessage(); as err) {
				<div role="alert" class="card mb-6 border-l-4 border-l-danger bg-danger/5">
					<div class="card-body flex items-start gap-3">
						<app-icon name="alert-circle" [size]="20" class="mt-0.5 shrink-0 text-danger" />
						<div class="flex-1">
							<p class="font-medium text-danger">No se pudo cargar el horario</p>
							<p class="mt-1 text-sm text-content-muted">{{ err }}</p>
						</div>
					</div>
				</div>
			} @else if (slots().length > 0) {
				<app-schedule-grid [slots]="slots()" />
			} @else {
				<app-empty-state
					icon="calendar"
					[title]="emptyTitle()"
					[description]="emptyDescription()"
				/>
			}
		</app-page-container>
	`,
})
export class SchedulePageComponent implements OnInit {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly auth = inject(AuthService);
	private readonly tenant = inject(TenantService);
	private readonly academicApi = inject(AcademicApiService);

	protected readonly ROUTES = ROUTES;
	protected readonly loading = signal(false);
	protected readonly errorMessage = signal<string | null>(null);
	protected readonly slots = signal<readonly ScheduleSlotItem[]>([]);

	protected readonly isAdmin = computed(() => this.auth.hasRole(UserRole.TenantAdmin));
	protected readonly isTeacher = computed(() => this.auth.hasRole(UserRole.Teacher));
	protected readonly isStudent = computed(() => this.auth.hasRole(UserRole.Student));

	protected readonly title = computed(() => {
		if (this.route.snapshot.url[0]?.path === 'me') return 'Mi horario';
		return 'Horarios';
	});

	protected readonly subtitle = computed(() => {
		const tenantName = this.tenant.tenant()?.name;
		if (this.isTeacher()) {
			return tenantName ? `Tu horario semanal en ${tenantName}.` : 'Tu horario semanal.';
		}
		if (this.isAdmin()) {
			return tenantName
				? `Vista global de horarios del colegio ${tenantName}.`
				: 'Vista global de horarios del colegio.';
		}
		return 'Horarios de tu sección.';
	});

	protected readonly emptyTitle = computed(() => {
		if (this.isTeacher()) return 'Aún no tenés horario asignado';
		if (this.isAdmin()) return 'Aún no hay horarios configurados';
		return 'Aún no hay horarios en tu sección';
	});

	protected readonly emptyDescription = computed(() => {
		if (this.isTeacher()) {
			return 'Cuando un administrador te asigne a una sección con horario, aparecerá acá.';
		}
		if (this.isAdmin()) {
			return 'Cuando crees docentes y secciones con sus horarios semanales, aparecerán acá.';
		}
		return 'Cuando el administrador configure el horario de tu sección, aparecerá acá.';
	});

	async ngOnInit(): Promise<void> {
		if (this.isTeacher()) {
			await this.loadTeacherSchedule();
		}
		// Admin + student branches are placeholders until cierre-C / B4
		// delivers the per-tenant / per-section schedule rendering.
	}

	/**
	 * Loads the current user's schedule.
	 *
	 * <p>The teacher's {@code publicUuid} is read from the user's auth
	 * profile when the BE populates it (see
	 * {@code AuthService.user().teacherPublicUuid}). For Sprint MVP, if
	 * the link is missing we surface a friendly empty state instead of
	 * attempting a lookup by email — that's been a source of stale-cache
	 * bugs in past sprints.</p>
	 */
	private async loadTeacherSchedule(): Promise<void> {
		this.loading.set(true);
		this.errorMessage.set(null);
		try {
			const user = this.auth.user();
			const teacherUuid: string | undefined = (user as { teacherPublicUuid?: string } | null)?.teacherPublicUuid;
			if (!teacherUuid) {
				// Empty state with hint to contact admin.
				this.loading.set(false);
				return;
			}
			const data = await firstValueFrom(this.academicApi.getTeacherSchedule(teacherUuid));
			this.slots.set(data ?? []);
		}
		catch (err: unknown) {
			this.errorMessage.set(
				err && typeof err === 'object' && 'message' in err
					? String((err as { message: unknown }).message)
					: 'Error desconocido.',
			);
		}
		finally {
			this.loading.set(false);
		}
	}
}