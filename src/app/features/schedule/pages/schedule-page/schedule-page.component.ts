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
import {
	AcademicYearRow,
	AcademicYearStatus,
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
import { ScheduleAdminNavComponent } from '../../components/schedule-admin-nav.component';
import { selectScheduleYear } from '../../utils/schedule-context.util';

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
		ScheduleAdminNavComponent,
	],
	template: `
		<app-page-container size="wide">
			<app-page-header
				eyebrow="Horarios"
				[title]="title()"
				[subtitle]="subtitle()"
			>
				@if (isTeacher()) {
					<a [routerLink]="ROUTES.SCHEDULE.MINE" class="btn btn-primary btn-sm">
						<app-icon name="user" [size]="14" />
						<span>Mi horario</span>
					</a>
				}
			</app-page-header>

			@if (isAdmin()) {
				<app-schedule-admin-nav
					[active]="'sections'"
					[yearUuid]="selectedYearUuid()"
					[periodUuid]="periodContextUuid()"
				/>
				<section class="card mb-8">
					<header class="card-header flex flex-wrap items-end justify-between gap-3">
						<div>
							<h2 class="card-title">Horario por sección</h2>
							<p class="card-description">
								Elige un año y una sección para revisar sus clases y completar los espacios vacíos.
							</p>
						</div>
						@if (selectedSectionUuid()) {
							<button
								type="button"
								class="btn btn-primary btn-sm"
								[disabled]="sectionLoading() || assignmentOptions().length === 0"
								(click)="openCreate(1)"
							>
								<app-icon name="plus" [size]="14" />
								Agregar clase
							</button>
						}
					</header>
					<div class="card-body space-y-4">
						<div class="grid gap-4 sm:grid-cols-2">
							<div class="field">
								<label class="label" for="schedule-year">Año académico</label>
								<select
									id="schedule-year"
									class="select"
									[ngModel]="selectedYearUuid()"
									(ngModelChange)="onYearChange($event)"
								>
									<option value="">Selecciona un año…</option>
									@for (year of years(); track year.publicUuid) {
										<option [value]="year.publicUuid">{{ year.name }}{{ isActiveYear(year) ? ' · Vigente' : '' }}</option>
									}
								</select>
							</div>
							<div class="field">
								<label class="label" for="schedule-section">Sección</label>
								<select
									id="schedule-section"
									class="select"
									[ngModel]="selectedSectionUuid()"
									(ngModelChange)="onSectionChange($event)"
									[disabled]="!selectedYearUuid() || sectionsLoading() || sections().length === 0"
								>
									<option [ngValue]="null">Selecciona una sección…</option>
									@for (group of sectionGroups(); track group.label) {
										<optgroup [label]="group.label">
											@for (section of group.sections; track section.publicUuid) {
												<option [ngValue]="section.publicUuid">
													{{ section.levelCode }} · {{ section.gradeName }} — Sección {{ section.name }}
												</option>
											}
										</optgroup>
									}
								</select>
							</div>
						</div>

						@if (sectionsLoading()) {
							<div class="flex items-center justify-center py-8">
								<app-spinner [size]="20" label="Cargando secciones…" />
							</div>
						} @else if (sectionListError()) {
							<div role="alert" class="alert alert-danger">
								<app-icon name="alert-circle" [size]="18" />
								<p class="flex-1 text-sm">{{ sectionListError() }}</p>
								<button type="button" class="btn btn-ghost btn-sm" (click)="reloadSections()">Reintentar</button>
							</div>
						} @else if (selectedYearUuid() && sections().length === 0) {
							<div class="rounded-lg border border-dashed border-border-subtle p-6 text-center">
								<p class="font-medium text-content">No hay secciones para este año</p>
								<p class="mt-1 text-sm text-content-muted">Crea las secciones del año académico para poder armar sus horarios.</p>
							</div>
						}

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
								[showDayAddActions]="false"
								[showSectionView]="false"
								[showTeacherView]="true"
								emptyTitle="Aún no hay horario para esta sección"
								(addRequested)="openCreate($event)"
								(slotSelected)="openEdit($event)"
								(periodSelected)="openFromPeriod($event)"
							/>
						} @else if (!selectedYearUuid()) {
							<p class="text-sm text-content-muted">Selecciona un año académico para revisar los horarios de sus secciones.</p>
						} @else {
							@if (sections().length > 0) {
								<p class="text-sm text-content-muted">Selecciona una sección para ver su horario.</p>
							}
						}
						@if (selectedSectionUuid() && assignmentOptions().length === 0 && !sectionLoading()) {
							<p class="text-sm text-amber-700">Asigna al menos un curso y docente a esta sección antes de agregar clases.</p>
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
	private readonly router = inject(Router);
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
	protected readonly sectionGroups = computed(() => {
		const grouped = new Map<string, SectionRow[]>();
		const ordered = [...this.sections()].sort((left, right) =>
			left.levelCode.localeCompare(right.levelCode) ||
			left.gradeOrdinal - right.gradeOrdinal ||
			left.name.localeCompare(right.name),
		);
		for (const section of ordered) {
			const label = `${section.levelCode} · ${section.gradeName}`;
			const group = grouped.get(label) ?? [];
			group.push(section);
			grouped.set(label, group);
		}
		return [...grouped].map(([label, sections]) => ({ label, sections }));
	});
	protected readonly years = signal<AcademicYearRow[]>([]);
	protected readonly periodContextUuid = signal(this.route.snapshot.queryParamMap.get('period'));
	protected isActiveYear(year: AcademicYearRow): boolean {
		return year.status === AcademicYearStatus.Active;
	}
	protected readonly selectedYearUuid = signal('');
	protected readonly sectionsLoading = signal(false);
	protected readonly sectionListError = signal<string | null>(null);
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
		if (this.isAdmin()) return 'Horario por sección';
		return 'Horarios';
	});

	protected readonly subtitle = computed(() => {
		const tenantName = this.tenant.tenant()?.name;
		if (this.isTeacher()) {
			return tenantName ? `Tu horario semanal en ${tenantName}.` : 'Tu horario semanal.';
		}
		if (this.isAdmin()) {
			return tenantName
				? `Organiza las clases por año y sección — ${tenantName}.`
				: 'Organiza las clases por año y sección.';
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
			return 'Selecciona un año y una sección para revisar o completar su horario.';
		}
		return 'Cuando el administrador configure el horario de tu sección, aparecerá acá.';
	});

	async ngOnInit(): Promise<void> {
		if (this.isAdmin()) {
			await this.loadAdminSchedule();
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

	protected async onYearChange(yearUuid: string): Promise<void> {
		this.selectedYearUuid.set(yearUuid);
		this.periodContextUuid.set(null);
		this.selectedSectionUuid.set(null);
		this.slots.set([]);
		this.nonTeachingBlocks.set([]);
		this.suggestedPeriods.set([]);
		this.assignmentOptions.set([]);
		this.sectionError.set(null);
		await this.router.navigate([], {
			relativeTo: this.route,
			queryParams: { year: yearUuid || null, section: null, period: null },
			queryParamsHandling: 'merge',
		});
		await this.loadSectionsForYear(yearUuid);
	}

	protected onSectionChange(uuid: string | null): void {
		this.selectedSectionUuid.set(uuid);
		void this.router.navigate([], {
			relativeTo: this.route,
			queryParams: { section: uuid },
			queryParamsHandling: 'merge',
		});
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

	protected reloadSections(): void {
		void this.loadSectionsForYear(this.selectedYearUuid());
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

	private async loadAdminSchedule(): Promise<void> {
		this.sectionsLoading.set(true);
		this.sectionListError.set(null);
		try {
			const years = await firstValueFrom(this.academicApi.listYears());
			this.years.set(years ?? []);
			const requestedYear = this.route.snapshot.queryParamMap.get('year');
			const yearUuid = selectScheduleYear(years ?? [], requestedYear)?.publicUuid ?? '';
			this.selectedYearUuid.set(yearUuid);
			if (requestedYear !== yearUuid) {
				await this.router.navigate([], {
					relativeTo: this.route,
					queryParams: {
						year: yearUuid || null,
						section: yearUuid ? this.route.snapshot.queryParamMap.get('section') : null,
						period: yearUuid ? this.route.snapshot.queryParamMap.get('period') : null,
					},
					queryParamsHandling: 'merge',
					replaceUrl: true,
				});
			}
			await this.loadSectionsForYear(yearUuid, this.route.snapshot.queryParamMap.get('section'));
		} catch (err: unknown) {
			this.sections.set([]);
			this.sectionListError.set(
				err && typeof err === 'object' && 'message' in err
					? String((err as { message: unknown }).message)
					: 'No se pudieron cargar los años académicos.',
			);
		} finally {
			this.sectionsLoading.set(false);
		}
	}

	private async loadSectionsForYear(yearUuid: string, preferredSectionUuid?: string | null): Promise<void> {
		this.sectionsLoading.set(true);
		this.sectionListError.set(null);
		try {
			const rows = yearUuid
				? await firstValueFrom(this.academicApi.listSections({ academicYearPublicUuid: yearUuid }))
				: [];
			this.sections.set(rows ?? []);
			const preferred = rows?.find((section) => section.publicUuid === preferredSectionUuid);
			const nextSectionUuid = preferred?.publicUuid ?? rows?.[0]?.publicUuid ?? null;
			this.selectedSectionUuid.set(nextSectionUuid);
			if (nextSectionUuid) {
				if (preferredSectionUuid !== nextSectionUuid) {
					await this.router.navigate([], {
						relativeTo: this.route,
						queryParams: { section: nextSectionUuid },
						queryParamsHandling: 'merge',
						replaceUrl: true,
					});
				}
				await this.loadSectionSchedule(nextSectionUuid);
			} else {
				this.slots.set([]);
				this.nonTeachingBlocks.set([]);
				this.suggestedPeriods.set([]);
			}
		} catch (err: unknown) {
			this.sections.set([]);
			this.selectedSectionUuid.set(null);
			this.sectionListError.set(
				err && typeof err === 'object' && 'message' in err
					? String((err as { message: unknown }).message)
					: 'No se pudieron cargar las secciones de este año.',
			);
		} finally {
			this.sectionsLoading.set(false);
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
