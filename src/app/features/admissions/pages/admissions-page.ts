import { AdmissionsPaginationComponent } from '../components/admissions-pagination.component';
import { A11yModule } from '@angular/cdk/a11y';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdmissionsNavigationComponent } from '../components/admissions-navigation.component';
import { AdmissionsWorkspaceService } from '../services/admissions-workspace.service';
import { admissionError } from '../models/admission-errors';
import { AcademicApiService } from '@features/academic/services/academic-api.service';
import { AcademicYearRow, Grade } from '@features/academic/models';
import { StudentsApiService } from '@features/students/services';
import { EnrollmentRow } from '@features/students/models';
import { AuthService } from '@core/services';
import { Permission } from '@core/enums';
import { AdmissionDetailPanelComponent } from './admission-detail-panel.component';
import { AdmissionsApiService } from '../services/admissions-api.service';
import {
  AdmissionApplication,
  AdmissionApplicationDetail,
  AdmissionDetailDecision,
  AdmissionStatus,
  GradeVacancy,
  AdmissionSectionVacancy,
} from '../models';

@Component({
  selector: 'app-admissions-page',
  standalone: true,
  imports: [
    CommonModule,
    A11yModule,
    AdmissionsPaginationComponent,
    FormsModule,
    RouterLink,
    AdmissionsNavigationComponent,
    AdmissionDetailPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admissions-page.html',
})
export class AdmissionsPage {
  private linkedDetailOpened = false;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly workspace = inject(AdmissionsWorkspaceService);
  private readonly destroyRef = inject(DestroyRef);
  private alive = true;
  private refreshVersion = 0;
  readonly view: string = this.route.snapshot.data?.['view'] ?? 'applications';
  readonly pageTitle = (
    {
      overview: 'Admisiones',
      applications: 'Solicitudes de admisión',
      vacancies: 'Vacantes',
      detail: 'Expediente de admisión',
    } as Record<string, string>
  )[this.view];
  readonly pageDescription = (
    {
      overview:
        'Organiza la atención de familias, la revisión de solicitudes y las matrículas pendientes.',
      applications: 'Revisa cada expediente y continúa con su siguiente paso.',
      vacancies: 'Consulta capacidad, ocupación y reservas antes de admitir.',
      detail: 'Revisa los datos y completa las acciones de esta solicitud.',
    } as Record<string, string>
  )[this.view];
  readonly pendingInquiries = signal(0);
  readonly overdueInquiries = signal(0);
  readonly pendingReview = computed(
    () => this.applications().filter((a) => ['RECEIVED', 'UNDER_REVIEW'].includes(a.status)).length,
  );
  readonly pendingEnrollment = computed(
    () =>
      this.applications().filter((a) => a.status === 'ADMITTED' && !a.enrollmentPublicUuid).length,
  );
  readonly capacityIssues = computed(
    () => this.vacancies().filter((v) => !v.capacityConfigured || v.availableSeats === 0).length,
  );
  readonly selectedVacancy = computed(() => {
    const application =
      this.detailApplicationSignal() ??
      this.applications().find((a) => a.publicUuid === this.detailUuidSignal());
    return this.vacancies().find((v) => v.gradePublicUuid === application?.gradePublicUuid) ?? null;
  });
  readonly vacancySections = signal<AdmissionSectionVacancy[]>([]);
  readonly vacancySectionsTitle = signal('');
  readonly sectionsLoading = signal(false);
  private sectionRequest = 0;
  private readonly api = inject(AdmissionsApiService);
  private readonly academic = inject(AcademicApiService);
  private readonly studentsApi = inject(StudentsApiService);
  private readonly auth = inject(AuthService);

  readonly detailApplicationSignal = signal<AdmissionApplication | null>(null);
  readonly detailUuidSignal = signal('');
  readonly detailReloadSignal = signal(0);
  readonly years = signal<AcademicYearRow[]>([]);
  readonly yearUuid = signal('');
  readonly applications = signal<AdmissionApplication[]>([]);
  readonly vacancies = signal<GradeVacancy[]>([]);
  readonly grades = signal<Grade[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly transitionTarget = signal<{
    application: AdmissionApplication;
    status: AdmissionStatus;
  } | null>(null);
  readonly enrollmentTarget = signal<AdmissionApplication | null>(null);
  readonly completionSections = signal<AdmissionSectionVacancy[]>([]);
  readonly applicationUuidFilter = signal(
    this.route.snapshot.queryParamMap.get('applicationId') ?? '',
  );
  readonly pageSignal = signal(this.workspace.applicationPage);
  readonly pagedApplications = computed(() => {
    const rows = this.filteredApplications();
    const page = Math.min(this.pageSignal(), Math.max(0, Math.ceil(rows.length / 20) - 1));
    return rows.slice(page * 20, page * 20 + 20);
  });
  readonly visiblePage = computed(() =>
    Math.min(
      this.pageSignal(),
      Math.max(0, Math.ceil(this.filteredApplications().length / 20) - 1),
    ),
  );
  readonly searchTerm = signal(this.workspace.applicationSearch);
  readonly statusFilter = signal(
    this.route.snapshot.queryParamMap.get('status') ?? this.workspace.applicationStatus,
  );
  readonly gradeFilter = signal(
    this.route.snapshot.queryParamMap.get('grade') ?? this.workspace.applicationGrade,
  );
  readonly statuses: AdmissionStatus[] = [
    'RECEIVED',
    'UNDER_REVIEW',
    'ADMITTED',
    'WAITLISTED',
    'REJECTED',
    'WITHDRAWN',
    'ENROLLED',
  ];
  readonly filteredApplications = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase();
    const status = this.statusFilter();
    return this.applications().filter(
      (item) =>
        (!this.applicationUuidFilter() || item.publicUuid === this.applicationUuidFilter()) &&
        (status === 'ALL' ||
          item.status === status ||
          (status === 'PENDING_REVIEW' && ['RECEIVED', 'UNDER_REVIEW'].includes(item.status))) &&
        (!this.gradeFilter() || item.gradePublicUuid === this.gradeFilter()) &&
        (!term || `${item.studentFullName} ${item.gradeName}`.toLocaleLowerCase().includes(term)),
    );
  });

  transitionNote = '';
  draftSectionUuid = '';
  draftEnrollmentDate = '';

  constructor() {
    this.academic
      .listYears()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (rows) => {
          this.years.set(rows);
          if (rows.length) {
            const active =
              rows.find(
                (year) =>
                  year.publicUuid ===
                  (this.route.snapshot.queryParamMap.get('yearId') ?? this.workspace.year),
              ) ??
              rows.find((year) => year.status === 'ACTIVE') ??
              rows[0];
            this.yearUuid.set(active.publicUuid);
            this.refresh();
          }
        },
        error: () => this.error.set('No se pudieron cargar los años académicos.'),
      });
    this.academic
      .listLevels()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (levels) => this.grades.set(levels.flatMap((level) => level.grades)),
        error: () => this.error.set('No se pudo cargar el catálogo de grados.'),
      });
    this.destroyRef.onDestroy(() => {
      this.alive = false;
      if (this.view === 'applications') {
        this.workspace.applicationPage = this.visiblePage();
        this.workspace.applicationScroll = window.scrollY;
      }
      this.refreshVersion++;
      this.workspace.year = this.yearUuid();
      this.workspace.applicationSearch = this.searchTerm();
      this.workspace.applicationStatus = this.statusFilter();
      this.workspace.applicationGrade = this.gradeFilter();
    });
    const uuid = this.route.snapshot.paramMap?.get('applicationUuid');
    if (this.view === 'detail')
      this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
        const next = params.get('applicationUuid');
        if (next) {
          this.detailApplicationSignal.set(null);
          this.detailUuidSignal.set(next);
        }
      });
    if (this.view === 'detail' && uuid) this.detailUuidSignal.set(uuid);
    if (this.route.snapshot.queryParamMap.get('existing') === '1' && this.canManageApplications())
      void this.router.navigate(['/admissions/new'], {
        queryParams: { existing: '1', yearId: this.yearUuid() },
      });
  }

  canReadInquiries(): boolean {
    return (
      this.auth.hasPermission(Permission.LmsAdmissionManage) ||
      this.auth.hasPermission(Permission.AdmissionsInquiriesRead)
    );
  }
  canReadApplications(): boolean {
    return (
      this.auth.hasPermission(Permission.LmsAdmissionManage) ||
      this.auth.hasPermission(Permission.AdmissionsApplicationsRead)
    );
  }
  onDetailLoaded(detail: AdmissionApplicationDetail): void {
    this.detailApplicationSignal.set(detail.application);
    if (this.yearUuid() !== detail.application.academicYearPublicUuid) {
      this.yearUuid.set(detail.application.academicYearPublicUuid);
      this.refresh();
    }
  }
  closeDetail(): void {
    void this.router.navigate(['/admissions/applications'], {
      queryParams: { yearId: this.yearUuid() },
    });
  }
  async loadVacancySections(vacancy: GradeVacancy): Promise<void> {
    const request = ++this.sectionRequest;
    this.vacancySectionsTitle.set(vacancy.gradeName);
    this.vacancySections.set([]);
    this.sectionsLoading.set(true);
    const year = this.yearUuid();
    try {
      const rows = await firstValueFrom(this.api.sectionVacancies(year, vacancy.gradePublicUuid));
      if (request === this.sectionRequest && year === this.yearUuid())
        this.vacancySections.set(rows);
    } catch (error) {
      this.error.set(admissionError(error, 'No se pudieron cargar las secciones.'));
    } finally {
      if (request === this.sectionRequest) this.sectionsLoading.set(false);
    }
  }
  canManageApplications(): boolean {
    return (
      this.auth.hasPermission(Permission.LmsAdmissionManage) ||
      this.auth.hasPermission(Permission.AdmissionsApplicationsManage)
    );
  }

  canDecide(): boolean {
    return (
      this.auth.hasPermission(Permission.LmsAdmissionManage) ||
      this.auth.hasPermission(Permission.AdmissionsDecide)
    );
  }

  canEnroll(): boolean {
    return (
      this.auth.hasPermission(Permission.LmsAdmissionManage) ||
      this.auth.hasPermission(Permission.AdmissionsEnroll)
    );
  }

  selectYear(event: Event): void {
    this.detailUuidSignal.set('');
    this.applicationUuidFilter.set('');
    this.yearUuid.set((event.target as HTMLSelectElement).value);
    this.workspace.year = this.yearUuid();
    this.vacancySectionsTitle.set('');
    this.sectionRequest++;
    this.pageSignal.set(0);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { yearId: this.yearUuid() },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.refresh();
  }

  refresh(): void {
    const year = this.yearUuid();
    if (!year) return;
    const version = ++this.refreshVersion;
    this.loading.set(true);
    this.error.set(null);
    this.applications.set([]);
    this.vacancies.set([]);
    this.detailReloadSignal.update((value) => value + 1);
    Promise.all([
      this.canReadApplications() && this.view !== 'detail' && this.view !== 'vacancies'
        ? firstValueFrom(this.api.list(year))
        : Promise.resolve([]),
      this.canReadApplications() ? firstValueFrom(this.api.vacancies(year)) : Promise.resolve([]),
      this.view === 'overview' && this.canReadInquiries()
        ? firstValueFrom(this.api.listInquiries(year))
        : Promise.resolve([]),
    ])
      .then(([applications, vacancies, inquiries]) => {
        if (version !== this.refreshVersion) return;
        this.applications.set(applications);
        this.vacancies.set(vacancies);
        this.pendingInquiries.set(inquiries.filter((i) => i.status === 'RECEIVED').length);
        const today = new Date().toLocaleDateString('en-CA');
        this.overdueInquiries.set(
          inquiries.filter(
            (i) =>
              !['CLOSED', 'CONVERTED'].includes(i.status) &&
              !!i.nextAttentionDate &&
              i.nextAttentionDate <= today,
          ).length,
        );
        if (!this.linkedDetailOpened && this.applicationUuidFilter()) {
          this.linkedDetailOpened = true;
          void this.router.navigate(['/admissions/applications', this.applicationUuidFilter()], {
            queryParams: { yearId: year },
          });
        }
        this.loading.set(false);
        if (this.view === 'applications')
          requestAnimationFrame(() => {
            if (this.alive) window.scrollTo(0, this.workspace.applicationScroll);
          });
      })
      .catch((error) => {
        if (version !== this.refreshVersion) return;
        this.error.set(
          admissionError(error, 'No se pudo cargar la información. Intenta nuevamente.'),
        );
        this.loading.set(false);
      });
  }

  openDetail(application: AdmissionApplication): void {
    void this.router.navigate(['/admissions/applications', application.publicUuid], {
      queryParams: { yearId: application.academicYearPublicUuid },
    });
  }
  decideFromDetail(event: AdmissionDetailDecision): void {
    if (!this.canDecide() || this.saving()) return;
    if (event.status === 'UNDER_REVIEW') this.quickTransition(event.application, event.status);
    else this.openTransition(event.application, event.status);
  }

  quickTransition(application: AdmissionApplication, status: AdmissionStatus): void {
    this.saving.set(true);
    this.api.transition(application.publicUuid, status).subscribe({
      next: () => {
        this.saving.set(false);
        this.notice.set('La postulación pasó a revisión.');
        this.refresh();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('No se pudo actualizar el estado.');
      },
    });
  }

  openTransition(application: AdmissionApplication, status: AdmissionStatus): void {
    this.error.set(null);
    this.transitionNote = '';
    this.transitionTarget.set({ application, status });
  }

  cancelTransition(): void {
    if (!this.saving()) this.transitionTarget.set(null);
  }

  submitTransition(): void {
    const target = this.transitionTarget();
    if (
      !target ||
      this.saving() ||
      (this.requiresNote(target.status) && !this.transitionNote.trim())
    )
      return;
    this.saving.set(true);
    this.api
      .transition(
        target.application.publicUuid,
        target.status,
        this.transitionNote.trim() || undefined,
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.transitionTarget.set(null);
          this.notice.set(`Estado actualizado: ${this.statusLabel(target.status)}.`);
          this.refresh();
        },
        error: (error) => {
          this.saving.set(false);
          this.error.set(
            admissionError(
              error,
              'No se pudo guardar la decisión. Actualiza e intenta nuevamente.',
            ),
          );
        },
      });
  }

  async linkExistingEnrollment(application: AdmissionApplication): Promise<void> {
    if (!application.studentPublicUuid || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const rows: EnrollmentRow[] = await firstValueFrom(
        this.studentsApi.listEnrollments(application.studentPublicUuid),
      );
      const enrollment = rows.find(
        (row) =>
          row.active &&
          row.academicYearPublicUuid === application.academicYearPublicUuid &&
          row.gradeName === application.gradeName,
      );
      if (!enrollment) {
        this.error.set(
          'Registra primero la matrícula activa del estudiante en la sección y año correspondientes.',
        );
        this.saving.set(false);
        return;
      }
      await firstValueFrom(this.api.linkEnrollment(application.publicUuid, enrollment.publicUuid));
      this.notice.set('La postulación quedó vinculada a la matrícula activa.');
      this.saving.set(false);
      this.refresh();
    } catch {
      this.error.set(
        'No se pudo vincular la matrícula. Verifica el año, el grado y el estado activo.',
      );
      this.saving.set(false);
    }
  }

  async openCompleteEnrollment(application: AdmissionApplication): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const sections = await firstValueFrom(
        this.api.sectionVacancies(application.academicYearPublicUuid, application.gradePublicUuid),
      );
      if (!sections.length) {
        this.error.set('Primero crea una sección del grado para el año académico elegido.');
        this.saving.set(false);
        return;
      }
      const year = this.years().find(
        (item) => item.publicUuid === application.academicYearPublicUuid,
      );
      this.completionSections.set(sections);
      this.draftSectionUuid = '';
      this.draftEnrollmentDate = (year?.startDate ?? new Date()).toISOString().slice(0, 10);
      this.enrollmentTarget.set(application);
      this.saving.set(false);
    } catch (error) {
      this.error.set(
        admissionError(error, 'No se pudieron cargar las secciones para este grado y año.'),
      );
      this.saving.set(false);
    }
  }

  closeCompleteEnrollment(): void {
    if (!this.saving()) this.enrollmentTarget.set(null);
  }

  submitCompleteEnrollment(): void {
    const target = this.enrollmentTarget();
    if (!target || this.saving() || !this.draftSectionUuid || !this.draftEnrollmentDate) return;
    this.saving.set(true);
    this.api
      .completeEnrollment(target.publicUuid, {
        sectionPublicUuid: this.draftSectionUuid,
        enrolledAt: this.draftEnrollmentDate,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.enrollmentTarget.set(null);
          this.notice.set('Estudiante, apoderado y matrícula creados correctamente.');
          this.refresh();
        },
        error: (error) => {
          this.saving.set(false);
          this.error.set(
            admissionError(
              error,
              'No se pudo completar. Verifica los datos del expediente, la capacidad, la sección y la fecha.',
            ),
          );
        },
      });
  }

  requiresNote(status: AdmissionStatus): boolean {
    return status === 'WAITLISTED' || status === 'REJECTED' || status === 'WITHDRAWN';
  }

  transitionTitle(status: AdmissionStatus): string {
    return status === 'ADMITTED'
      ? 'Admitir postulante'
      : status === 'WAITLISTED'
        ? 'Enviar a lista de espera'
        : status === 'REJECTED'
          ? 'Rechazar postulación'
          : 'Retirar postulación';
  }

  statusLabel(status: AdmissionStatus): string {
    return {
      RECEIVED: 'Recibida',
      UNDER_REVIEW: 'En revisión',
      ADMITTED: 'Admitida',
      WAITLISTED: 'Lista de espera',
      REJECTED: 'Rechazada',
      WITHDRAWN: 'Retirada',
      ENROLLED: 'Matriculada',
    }[status];
  }

  sourceLabel(source: AdmissionApplication['source']): string {
    return {
      IN_PERSON: 'Presencial',
      REFERRAL: 'Recomendación',
      WEBSITE: 'Sitio web',
      OTHER: 'Otro',
    }[source];
  }

  statusClass(status: AdmissionStatus): string {
    if (status === 'ADMITTED' || status === 'ENROLLED')
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    if (status === 'REJECTED' || status === 'WITHDRAWN')
      return 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
    if (status === 'WAITLISTED')
      return 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  }
}
