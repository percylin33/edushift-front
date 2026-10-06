import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	OnInit,
	computed,
	inject,
	signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import {
	NonTeachingBlockItem,
	ScheduleSlotItem,
	SectionRow,
	SuggestedPeriodItem,
	enrichScheduleSlotsWithGrades,
} from '@features/academic/models';
import {
	ScheduleGridComponent,
	SuggestedPeriodSelection,
} from '@features/academic/components/schedule-grid.component';
import {
	TimeSlotAssignmentOption,
	TimeSlotFormModalComponent,
} from '@features/academic/components/time-slot-form-modal.component';
import {
	dedupeYearScheduleSlots,
	groupSectionTeachersAsYearOptions,
} from '@features/academic/utils/schedule-assignment.util';
import { MeApiService } from '@features/me/services/me-api.service';
import { TeachersApiService } from '@features/teachers/services';
import { ScheduleApiService } from '../../services/schedule-api.service';

/**
 * Top-level {@code /schedule} route — role-aware landing.
 *
 * <ul>
 *   <li><b>TENANT_ADMIN</b>: hub jornada/workload + editor de horario por sección
 *       (crear/editar TimeSlots; UAT-SCH-05).</li>
 *   <li><b>TEACHER</b>: week view (solo lectura; mutaciones solo admin).</li>
 *   <li><b>STUDENT</b>: week view vía {@code /me/schedule}.</li>
 * </ul>
 */
@Component({
	selector: 'app-schedule-page',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		CommonModule,
		FormsModule,
		RouterLink,
		PageContainerComponent,
		PageHeaderComponent,
		IconComponent,
		EmptyStateComponent,
		SpinnerComponent,
		ScheduleGridComponent,
		TimeSlotFormModalComponent,
	],
	template: `
		<app-page-container size="wide">
			<app-page-header
				eyebrow="Horarios"
				[title]="title()"
				[subtitle]="subtitle()"
			>
				@if (isAdmin()) {
					<a [routerLink]="ROUTES.SCHEDULE.JORNADA" class="btn btn-primary btn-sm">
						<app-icon name="calendar" [size]="14" />
						<span>Jornada</span>
					</a>
					<a [routerLink]="ROUTES.SCHEDULE.WORKLOAD" class="btn btn-outline btn-sm">
						<app-icon name="users" [size]="14" />
						<span>Carga docente</span>
					</a>
				}
				@if (isTeacher()) {
					<a [routerLink]="ROUTES.SCHEDULE.MINE" class="btn btn-primary btn-sm">
						<app-icon name="user" [size]="14" />
						<span>Mi horario</span>
					</a>
				}
			</app-page-header>

			@if (isAdmin() && !loading()) {
				<section class="mb-8 grid gap-4 sm:grid-cols-2">
					<a
						[routerLink]="ROUTES.SCHEDULE.JORNADA"
						class="card transition-shadow hover:shadow-md"
					>
						<div class="card-body">
							<div class="mb-2 flex items-center gap-2 text-content">
								<app-icon name="calendar" [size]="20" />
								<h2 class="text-base font-semibold">Jornada y recreos</h2>
							</div>
							<p class="text-sm text-content-muted">
								Configurá la política de recreos, plantillas de día por nivel, sembrado
								de defaults, bootstrap desde archivo y clonado entre años.
							</p>
						</div>
					</a>
					<a
						[routerLink]="ROUTES.SCHEDULE.WORKLOAD"
						class="card transition-shadow hover:shadow-md"
					>
						<div class="card-body">
							<div class="mb-2 flex items-center gap-2 text-content">
								<app-icon name="users" [size]="20" />
								<h2 class="text-base font-semibold">Carga horaria docente</h2>
							</div>
							<p class="text-sm text-content-muted">
								Revisá minutos semanales, cantidad de bloques, secciones y cursos por
								docente en el periodo seleccionado.
							</p>
						</div>
					</a>
				</section>

				<section class="card mb-8">
					<header class="card-header flex flex-wrap items-end justify-between gap-3">
						<div>
							<h2 class="card-title">Horario por sección</h2>
							<p class="card-description">
								Creá o editá bloques de clase. Si el horario invade un recreo, el modal
								muestra el error SCHEDULE_CONFLICT.
							</p>
						</div>
						@if (selectedSectionUuid()) {
							<button type="button" class="btn btn-primary btn-sm" (click)="openCreate(1)">
								<app-icon name="plus" [size]="14" />
								Nuevo bloque
							</button>
						}
					</header>
					<div class="card-body space-y-4">
						<div class="field max-w-md">
							<label class="label" for="schedule-section">Sección</label>
							<select
								id="schedule-section"
								class="select"
								[ngModel]="selectedSectionUuid()"
								(ngModelChange)="onSectionChange($event)"
							>
								<option [ngValue]="null">Selecciona una sección…</option>
								@for (s of sections(); track s.publicUuid) {
									<option [ngValue]="s.publicUuid">
										{{ s.levelCode }} · {{ s.gradeName }} — {{ s.name }}
									</option>
								}
							</select>
						</div>

						@if (sectionLoading()) {
							<div class="flex items-center justify-center py-12">
								<app-spinner [size]="24" label="Cargando horario de sección…" />
							</div>
						} @else if (sectionError()) {
							<div class="alert alert-danger">
								<app-icon name="alert-circle" [size]="18" />
								<p class="flex-1 text-sm">{{ sectionError() }}</p>
								<button type="button" class="btn btn-ghost btn-sm" (click)="reloadSection()">
									Reintentar
								</button>
							</div>
						} @else if (selectedSectionUuid()) {
							<app-schedule-grid
								[slots]="slots()"
								[nonTeachingBlocks]="nonTeachingBlocks()"
								[suggestedPeriods]="suggestedPeriods()"
								[editable]="true"
								[showSectionView]="false"
								[showTeacherView]="true"
								emptyTitle="Aún no hay horario para esta sección"
								(addRequested)="openCreate($event)"
								(slotSelected)="openEdit($event)"
								(periodSelected)="openFromPeriod($event)"
							/>
						} @else {
							<p class="text-sm text-content-muted">
								Elegí una sección para ver recreos y bloques de clase, y para probar
								conflictos (UAT-SCH-05).
							</p>
						}
					</div>
				</section>
			}

			@if (loading()) {
				<div class="flex items-center justify-center py-16">
					<app-spinner [size]="24" label="Cargando horario…" />
				</div>
			} @else if (errorMessage()) {
				<div role="alert" class="card mb-6 border-l-4 border-l-danger bg-danger/5">
					<div class="card-body flex items-start gap-3">
						<app-icon name="alert-circle" [size]="20" class="mt-0.5 shrink-0 text-danger" />
						<div class="flex-1">
							<p class="font-medium text-danger">No se pudo cargar el horario</p>
							<p class="mt-1 text-sm text-content-muted">{{ errorMessage() }}</p>
						</div>
					</div>
				</div>
			} @else if (!isAdmin() && (slots().length > 0 || nonTeachingBlocks().length > 0)) {
				<app-schedule-grid
					[slots]="slots()"
					[nonTeachingBlocks]="nonTeachingBlocks()"
					[suggestedPeriods]="suggestedPeriods()"
					[showSectionView]="isTeacher()"
					[showTeacherView]="isStudent()"
				/>
			} @else if (!isAdmin()) {
				<app-empty-state
					icon="calendar"
					[title]="emptyTitle()"
					[description]="emptyDescription()"
				/>
			}
		</app-page-container>

		@if (modalOpen()) {
			<app-time-slot-form-modal
				[assignments]="assignmentOptions()"
				[yearSlots]="yearSlots()"
				[initialDayOfWeek]="modalDay()"
				[initialStartTime]="modalStart()"
				[initialEndTime]="modalEnd()"
				[slot]="editingSlot()"
				(closed)="closeModal()"
				(saved)="onModalSaved()"
				(deleted)="onModalSaved()"
			/>
		}
	`,
})
export class SchedulePageComponent implements OnInit {
	private readonly route = inject(ActivatedRoute);
	private readonly auth = inject(AuthService);
	private readonly tenant = inject(TenantService);
	private readonly scheduleApi = inject(ScheduleApiService);
	private readonly academicApi = inject(AcademicApiService);
	private readonly teachersApi = inject(TeachersApiService);
	private readonly meApi = inject(MeApiService);

	protected readonly ROUTES = ROUTES;
	protected readonly loading = signal(false);
	protected readonly errorMessage = signal<string | null>(null);
	protected readonly slots = signal<readonly ScheduleSlotItem[]>([]);
	/** Raw (undeduped) week slots — used by the modal to find sibling year replicas. */
	protected readonly yearSlots = signal<readonly ScheduleSlotItem[]>([]);
	protected readonly nonTeachingBlocks = signal<readonly NonTeachingBlockItem[]>([]);
	protected readonly suggestedPeriods = signal<readonly SuggestedPeriodItem[]>([]);

	protected readonly sections = signal<SectionRow[]>([]);
	protected readonly selectedSectionUuid = signal<string | null>(null);
	protected readonly sectionLoading = signal(false);
	protected readonly sectionError = signal<string | null>(null);
	protected readonly assignmentOptions = signal<TimeSlotAssignmentOption[]>([]);

	protected readonly modalOpen = signal(false);
	protected readonly modalDay = signal<number | null>(null);
	protected readonly modalStart = signal<string | null>(null);
	protected readonly modalEnd = signal<string | null>(null);
	protected readonly editingSlot = signal<ScheduleSlotItem | null>(null);

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
				? `Jornada, carga docente y edición de bloques — ${tenantName}.`
				: 'Jornada, carga docente y edición de bloques de clase.';
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
			return 'Usá Jornada para configurar recreos y plantillas, o el editor por sección más abajo.';
		}
		return 'Cuando el administrador configure el horario de tu sección, aparecerá acá.';
	});

	async ngOnInit(): Promise<void> {
		if (this.isAdmin()) {
			await this.loadSections();
			return;
		}
		if (this.isTeacher()) {
			await this.loadTeacherSchedule();
			return;
		}
		if (this.isStudent()) {
			await this.loadStudentSchedule();
		}
	}

	protected onSectionChange(uuid: string | null): void {
		this.selectedSectionUuid.set(uuid);
		if (uuid) {
			void this.loadSectionSchedule(uuid);
		} else {
			this.slots.set([]);
			this.nonTeachingBlocks.set([]);
			this.suggestedPeriods.set([]);
			this.assignmentOptions.set([]);
			this.sectionError.set(null);
		}
	}

	protected reloadSection(): void {
		const uuid = this.selectedSectionUuid();
		if (uuid) void this.loadSectionSchedule(uuid);
	}

	protected openCreate(dayOfWeek: number): void {
		this.editingSlot.set(null);
		this.modalDay.set(dayOfWeek);
		this.modalStart.set(null);
		this.modalEnd.set(null);
		this.modalOpen.set(true);
	}

	protected openFromPeriod(period: SuggestedPeriodSelection): void {
		this.editingSlot.set(null);
		this.modalDay.set(period.dayOfWeek);
		this.modalStart.set(period.startTime);
		this.modalEnd.set(period.endTime);
		this.modalOpen.set(true);
	}

	protected openEdit(slot: ScheduleSlotItem): void {
		this.editingSlot.set(slot);
		this.modalDay.set(null);
		this.modalStart.set(null);
		this.modalEnd.set(null);
		this.modalOpen.set(true);
	}

	protected closeModal(): void {
		this.modalOpen.set(false);
		this.editingSlot.set(null);
		this.modalDay.set(null);
		this.modalStart.set(null);
		this.modalEnd.set(null);
	}

	protected onModalSaved(): void {
		this.closeModal();
		const uuid = this.selectedSectionUuid();
		if (uuid) void this.loadSectionSchedule(uuid);
	}

	private async loadSections(): Promise<void> {
		try {
			const rows = await firstValueFrom(this.academicApi.listSections());
			this.sections.set(rows);
		} catch {
			this.sections.set([]);
		}
	}

	private async loadSectionSchedule(sectionUuid: string): Promise<void> {
		this.sectionLoading.set(true);
		this.sectionError.set(null);
		try {
			const [view, teachers] = await Promise.all([
				firstValueFrom(this.scheduleApi.getSectionScheduleWeek(sectionUuid)),
				firstValueFrom(this.teachersApi.listSectionTeachers(sectionUuid)),
			]);
			const rawSlots = view.slots ?? [];
			this.yearSlots.set(rawSlots);
			this.slots.set(dedupeYearScheduleSlots(rawSlots));
			this.nonTeachingBlocks.set(view.nonTeachingBlocks ?? []);
			this.suggestedPeriods.set(view.suggestedPeriods ?? []);
			this.assignmentOptions.set(groupSectionTeachersAsYearOptions(teachers));
		} catch (err: unknown) {
			this.sectionError.set(
				err && typeof err === 'object' && 'message' in err
					? String((err as { message: unknown }).message)
					: 'Error al cargar el horario de la sección.',
			);
		} finally {
			this.sectionLoading.set(false);
		}
	}

	private async loadTeacherSchedule(): Promise<void> {
		this.loading.set(true);
		this.errorMessage.set(null);
		try {
			const [teacher, sections] = await Promise.all([
				firstValueFrom(this.teachersApi.getMe()),
				firstValueFrom(this.academicApi.listSections()).catch(() => [] as SectionRow[]),
			]);
			const view = await firstValueFrom(
				this.scheduleApi.getTeacherScheduleWeek(teacher.publicUuid),
			);
			const rawSlots = dedupeYearScheduleSlots(view.slots ?? []);
			this.slots.set(enrichScheduleSlotsWithGrades(rawSlots, sections));
			this.nonTeachingBlocks.set(view.nonTeachingBlocks ?? []);
			this.suggestedPeriods.set(view.suggestedPeriods ?? []);
		} catch (err: unknown) {
			// Unlinked TEACHER user → empty state, not a hard error.
			if (this.isNotFoundError(err)) {
				this.slots.set([]);
				this.nonTeachingBlocks.set([]);
				this.suggestedPeriods.set([]);
				return;
			}
			this.errorMessage.set(
				err && typeof err === 'object' && 'message' in err
					? String((err as { message: unknown }).message)
					: 'Error desconocido.',
			);
		} finally {
			this.loading.set(false);
		}
	}

	private isNotFoundError(err: unknown): boolean {
		if (!err || typeof err !== 'object') return false;
		const status = (err as { status?: unknown }).status;
		return status === 404;
	}

	private async loadStudentSchedule(): Promise<void> {
		this.loading.set(true);
		this.errorMessage.set(null);
		try {
			const [response, sections] = await Promise.all([
				firstValueFrom(this.meApi.listSchedule()),
				firstValueFrom(this.academicApi.listSections()).catch(() => [] as SectionRow[]),
			]);
			const view = response.data;
			const rawSlots = dedupeYearScheduleSlots(view?.slots ?? []);
			this.slots.set(enrichScheduleSlotsWithGrades(rawSlots, sections));
			this.nonTeachingBlocks.set(view?.nonTeachingBlocks ?? []);
			this.suggestedPeriods.set(view?.suggestedPeriods ?? []);
		} catch (err: unknown) {
			this.errorMessage.set(
				err && typeof err === 'object' && 'message' in err
					? String((err as { message: unknown }).message)
					: 'Error desconocido.',
			);
		} finally {
			this.loading.set(false);
		}
	}
}
