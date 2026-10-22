import { createFormProtection } from '@shared/services/form-protection.service';
import { AdmissionsPaginationComponent } from '../components/admissions-pagination.component';
import { A11yModule } from '@angular/cdk/a11y';
import { ExistingStudentAdmissionComponent } from '../components/existing-student-admission.component';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AdmissionsNavigationComponent } from '../components/admissions-navigation.component';
import { AdmissionsWorkspaceService } from '../services/admissions-workspace.service';
import { admissionError } from '../models/admission-errors';
import { AcademicApiService } from '@features/academic/services/academic-api.service';
import { AcademicYearRow } from '@features/academic/models';
import { TenantService } from '@core/services/tenant.service';
import { AuthService } from '@core/services';
import { Permission } from '@core/enums';
import {
  AdmissionInquiry,
  AdmissionInquiryEvent,
  AdmissionInquiryStatus,
  CreateAdmissionFromInquiry,
} from '../models';
import { AdmissionsApiService } from '../services/admissions-api.service';

@Component({
  selector: 'app-admissions-inquiries-page',
  standalone: true,
  imports: [
    CommonModule,
    A11yModule,
    ExistingStudentAdmissionComponent,
    AdmissionsPaginationComponent,
    FormsModule,
    RouterLink,
    AdmissionsNavigationComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admissions-inquiries-page.html',
})
export class AdmissionsInquiriesPage {
  protected readonly formProtection = createFormProtection({
    snapshot: () => {
      const inquiry = this.noteInquiry();
      if (inquiry)
        return [
          'attention',
          inquiry.publicUuid,
          this.attentionChannel,
          this.attentionNote,
          this.responsibleName,
          this.nextAttentionDate,
          this.nextAction,
          this.noteStatus,
        ];
      if (this.convertInquiry() || this.presentialOpen())
        return [
          'applicant',
          this.draft,
          this.draftYearUuid,
          this.draftGradeUuid,
          this.correctionReason,
        ];
      if (this.existingStudentSignal())
        return ['existing-student', this.existingDirtySignal()];
      return [];
    },
    saving: () => this.saving() || this.existingBusySignal(),
    active: () =>
      !!this.noteInquiry() ||
      !!this.convertInquiry() ||
      this.presentialOpen() ||
      this.existingStudentSignal(),
  });
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly workspace = inject(AdmissionsWorkspaceService);
  private readonly destroyRef = inject(DestroyRef);
  private alive = true;
  readonly antecedentSearchSignal = signal('');
  readonly antecedentsLoadingSignal = signal(false);
  readonly antecedentsSignal = computed(() => {
    const term = this.normalize(this.antecedentSearchSignal());
    return term.length < 3
      ? []
      : this.inquiries()
          .filter(
            (i) =>
              this.normalize(`${i.contactName} ${i.contactValue}`).includes(term) ||
              (term.replace(/\D/g, '').length >= 3 &&
                i.contactValue.replace(/\D/g, '').includes(term.replace(/\D/g, ''))),
          )
          .slice(0, 5);
  });
  readonly existingDirtySignal = signal(false);
  readonly existingBusySignal = signal(false);
  readonly existingStudentSignal = signal(
    this.route.snapshot.queryParamMap.get('existing') === '1',
  );
  readonly editUuid = this.route.snapshot.queryParamMap.get('edit') ?? '';
  readonly editingSignal = signal(false);
  correctionReason = '';
  readonly creationPage = this.route.snapshot.data['creation'] === true;
  readonly wizardStepSignal = signal(0);
  readonly stepLabels = ['Destino', 'Estudiante', 'Apoderado', 'Confirmación'];
  readonly previousStep = (step: number): number => Math.max(0, step - 1);
  readonly overdueSignal = signal(this.route.snapshot.queryParamMap.get('overdue') === '1');
  readonly historyLoadingSignal = signal(false);
  readonly historyErrorSignal = signal('');
  private historySubscription?: Subscription;
  private refreshSubscription?: Subscription;
  responsibleName = '';
  nextAttentionDate = '';
  nextAction = '';
  private initialDraft = '';
  private readonly academic = inject(AcademicApiService);
  private readonly api = inject(AdmissionsApiService);
  private readonly tenant = inject(TenantService);
  private readonly auth = inject(AuthService);
  readonly years = signal<AcademicYearRow[]>([]);
  readonly yearUuid = signal('');
  readonly inquiries = signal<AdmissionInquiry[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly convertInquiry = signal<AdmissionInquiry | null>(null);
  readonly historyInquiry = signal<AdmissionInquiry | null>(null);
  readonly historyEvents = signal<AdmissionInquiryEvent[]>([]);
  readonly statusFilter = signal(
    this.route.snapshot.queryParamMap.get('status') ?? this.workspace.inquiryStatus,
  );
  readonly statuses: AdmissionInquiryStatus[] = [
    'RECEIVED',
    'CONTACTED',
    'QUALIFIED',
    'CONVERTED',
    'CLOSED',
  ];
  readonly pageSignal = signal(this.workspace.inquiryPage);
  readonly pagedInquiries = computed(() => {
    const rows = this.filteredInquiries();
    const page = Math.min(this.pageSignal(), Math.max(0, Math.ceil(rows.length / 20) - 1));
    return rows.slice(page * 20, page * 20 + 20);
  });
  readonly visiblePage = computed(() =>
    Math.min(this.pageSignal(), Math.max(0, Math.ceil(this.filteredInquiries().length / 20) - 1)),
  );
  readonly searchTerm = signal(this.workspace.inquirySearch);
  readonly gradeFilter = signal(this.workspace.inquiryGrade);
  readonly grades = signal<{ publicUuid: string; name: string }[]>([]);
  readonly presentialOpen = signal(false);
  readonly noteInquiry = signal<AdmissionInquiry | null>(null);
  attentionChannel = 'Presencial';
  attentionNote = '';
  draftGradeUuid = '';
  draftYearUuid = '';
  noteStatus: AdmissionInquiryStatus | null = null;
  readonly filteredInquiries = computed(() => {
    const term = this.normalize(this.searchTerm());
    const digits = term.replace(/\D/g, '');
    return this.inquiries().filter(
      (row) =>
        (this.statusFilter() === 'ALL' || row.status === this.statusFilter()) &&
        (!this.overdueSignal() ||
          (!['CLOSED', 'CONVERTED'].includes(row.status) &&
            !!row.nextAttentionDate &&
            row.nextAttentionDate <= new Date().toLocaleDateString('en-CA'))) &&
        (!this.gradeFilter() || row.gradePublicUuid === this.gradeFilter()) &&
        (!term ||
          this.normalize(
            `${row.contactName} ${this.gradeLabel(row.gradePublicUuid, row.gradeName)}`,
          ).includes(term) ||
          (digits.length > 0 &&
            /^[+0-9()\s-]+$/.test(term) &&
            row.contactValue.replace(/\D/g, '').includes(digits))),
    );
  });
  readonly publicFormUrl = computed(() => {
    const slug = this.tenant.tenantSlug();
    return slug
      ? `${window.location.origin}/public/admissions/${encodeURIComponent(slug)}`
      : `${window.location.origin}/public/admissions/slug-del-colegio`;
  });
  draft: CreateAdmissionFromInquiry = this.emptyDraft();

  constructor() {
    const route = this.route;
    this.presentialOpen.set(
      (route.snapshot.data['presential'] === true ||
        route.snapshot.queryParamMap.get('new') === '1') &&
        this.canFormalize(),
    );
    this.academic
      .listLevels()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (levels) =>
          this.grades.set(
            levels.flatMap((level) =>
              level.grades.map((grade) => ({
                publicUuid: grade.publicUuid,
                name: `${level.name} · ${grade.name}`,
              })),
            ),
          ),
        error: () => this.error.set('No se pudieron cargar los grados.'),
      });
    this.academic
      .listYears()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (years) => {
          this.years.set(years);
          const active =
            years.find(
              (year) =>
                year.publicUuid ===
                (this.route.snapshot.queryParamMap.get('yearId') ?? this.workspace.year),
            ) ??
            years.find((year) => year.status === 'ACTIVE') ??
            years.find((year) => year.status !== 'CLOSED');
          if (active) {
            this.yearUuid.set(active.publicUuid);
            this.draftYearUuid = active.publicUuid;
            this.refresh();
          }
          if (this.editUuid) this.loadEditableApplicant();
        },
        error: () => this.error.set('No se pudieron cargar los años académicos.'),
      });
    this.destroyRef.onDestroy(() => {
      this.alive = false;
      this.workspace.inquiryPage = this.visiblePage();
      if (!this.creationPage) this.workspace.inquiryScroll = window.scrollY;
      this.historySubscription?.unsubscribe();
      this.refreshSubscription?.unsubscribe();
      this.workspace.year = this.yearUuid();
      this.workspace.inquirySearch = this.searchTerm();
      this.workspace.inquiryStatus = this.statusFilter();
      this.workspace.inquiryGrade = this.gradeFilter();
    });
  }

  private loadEditableApplicant(): void {
    this.loading.set(true);
    this.api
      .detail(this.editUuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const detail = response.data;
          if (
            !detail.editableApplicant ||
            !['RECEIVED', 'UNDER_REVIEW', 'WAITLISTED'].includes(detail.application.status)
          ) {
            this.error.set('Esta solicitud no admite corrección de datos desde Admisiones.');
            this.loading.set(false);
            return;
          }
          this.draft = { ...detail.editableApplicant };
          this.draftYearUuid = detail.application.academicYearPublicUuid;
          this.draftGradeUuid = detail.application.gradePublicUuid;
          this.editingSignal.set(true);
          this.presentialOpen.set(true);
          this.wizardStepSignal.set(0);
          this.captureDraft();
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(admissionError(error, 'No se pudo cargar el expediente para corregirlo.'));
          this.loading.set(false);
        },
      });
  }
  private focusWizard(): void {
    setTimeout(() => {
      const title = document.getElementById('convert-title');
      title?.focus();
      title?.scrollIntoView({ block: 'start' });
    });
  }
  loadAntecedents(): void {
    if (!this.canReadInquiries() || !this.draftYearUuid) return;
    this.antecedentsLoadingSignal.set(true);
    this.refreshSubscription?.unsubscribe();
    this.refreshSubscription = this.api.listInquiries(this.draftYearUuid).subscribe({
      next: (rows) => {
        this.inquiries.set(rows);
        this.antecedentsLoadingSignal.set(false);
      },
      error: () => {
        this.antecedentsLoadingSignal.set(false);
        this.error.set(
          'No se pudieron buscar consultas previas. Puedes reintentar o continuar con el registro.',
        );
      },
    });
  }
  private captureDraft(): void {
    this.initialDraft = JSON.stringify([this.draft, this.draftYearUuid, this.draftGradeUuid]);
  }
  advanceStep(): void {
    if (this.wizardStepSignal() < 3) this.wizardStepSignal.update((step) => step + 1);
    else this.convert();
  }
  applicationStatusLabel(status: string): string {
    return (
      (
        {
          RECEIVED: 'Recibida',
          UNDER_REVIEW: 'En revisión',
          ADMITTED: 'Admitida',
          WAITLISTED: 'En espera',
          REJECTED: 'Rechazada',
          WITHDRAWN: 'Retirada',
          ENROLLED: 'Matriculada',
        } as Record<string, string>
      )[status] ?? status
    );
  }

  selectYear(event: Event): void {
    this.yearUuid.set((event.target as HTMLSelectElement).value);
    this.workspace.year = this.yearUuid();
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
    if (
      this.creationPage ||
      !year ||
      !(
        this.auth.hasPermission(Permission.LmsAdmissionManage) ||
        this.auth.hasPermission(Permission.AdmissionsInquiriesRead)
      )
    )
      return;
    this.pageSignal.set(0);
    this.refreshSubscription?.unsubscribe();
    this.inquiries.set([]);
    this.error.set(null);
    this.loading.set(true);
    this.refreshSubscription = this.api.listInquiries(year).subscribe({
      next: (rows) => {
        this.inquiries.set(rows);
        this.loading.set(false);
        requestAnimationFrame(() => {
          if (this.alive) window.scrollTo(0, this.workspace.inquiryScroll);
        });
      },
      error: () => {
        this.error.set('No se pudo cargar la bandeja de consultas.');
        this.loading.set(false);
      },
    });
  }

  changeStatus(inquiry: AdmissionInquiry, status: AdmissionInquiryStatus): void {
    this.saving.set(true);
    this.error.set(null);
    this.api.updateInquiry(inquiry.publicUuid, status).subscribe({
      next: () => {
        this.saving.set(false);
        this.notice.set(`Consulta actualizada: ${this.statusLabel(status)}.`);
        this.refresh();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('No se pudo actualizar el estado de la consulta.');
      },
    });
  }

  openConvert(inquiry: AdmissionInquiry): void {
    this.error.set(null);
    this.draft = this.emptyDraft();
    this.draft.guardianPhone = inquiry.contactType === 'PHONE' ? inquiry.contactValue : '';
    this.draft.guardianEmail = inquiry.contactType === 'EMAIL' ? inquiry.contactValue : '';
    const names = inquiry.contactName.trim().split(/\s+/);
    this.draft.guardianFirstName = names[0] ?? '';
    this.draft.guardianLastName = names.slice(1).join(' ');
    this.draft.source = 'WEBSITE';
    this.wizardStepSignal.set(0);
    this.draftYearUuid = inquiry.academicYearPublicUuid;
    this.draftGradeUuid = inquiry.gradePublicUuid;
    this.presentialOpen.set(false);
    this.convertInquiry.set(inquiry);
    this.captureDraft();
    this.formProtection.markSaved();
    this.focusWizard();
  }
  openPresential(): void {
    this.error.set(null);
    this.draft = this.emptyDraft();
    this.draft.source = 'IN_PERSON';
    this.draftGradeUuid = '';
    this.draftYearUuid = this.yearUuid();
    this.convertInquiry.set(null);
    this.presentialOpen.set(true);
    this.wizardStepSignal.set(0);
    this.captureDraft();
    this.formProtection.markSaved();
    this.loadAntecedents();
    this.focusWizard();
  }
  closeConvert(): void {
    this.formProtection.requestClose(() => {
      this.convertInquiry.set(null);
      this.presentialOpen.set(false);
      this.initialDraft = '';
      this.formProtection.markSaved();
      if (this.editingSignal())
        void this.router.navigate(['/admissions/applications', this.editUuid], {
          queryParams: { yearId: this.draftYearUuid },
        });
    });
  }
  gradeLabel(uuid: string, fallback: string): string {
    return this.grades().find((grade) => grade.publicUuid === uuid)?.name ?? fallback;
  }
  selectedYearName(): string {
    return this.years().find((year) => year.publicUuid === this.draftYearUuid)?.name ?? '';
  }
  applicationUrl(inquiry: AdmissionInquiry): string {
    return `/admissions?yearId=${encodeURIComponent(inquiry.convertedAcademicYearPublicUuid ?? inquiry.academicYearPublicUuid)}&applicationId=${encodeURIComponent(inquiry.convertedApplicationPublicUuid ?? '')}`;
  }
  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .trim();
  }
  openNote(inquiry: AdmissionInquiry): void {
    this.error.set(null);
    this.attentionChannel = 'Presencial';
    this.attentionNote = '';
    this.noteStatus = null;
    this.responsibleName = inquiry.responsibleName ?? '';
    this.nextAttentionDate = inquiry.nextAttentionDate ?? '';
    this.nextAction = inquiry.nextAction ?? '';
    this.noteInquiry.set(inquiry);
  }
  saveNote(): void {
    const inquiry = this.noteInquiry();
    if (!inquiry || !this.attentionNote.trim() || this.saving()) return;
    this.saving.set(true);
    const status =
      this.noteStatus ?? (inquiry.status === 'RECEIVED' ? 'CONTACTED' : inquiry.status);
    this.api
      .updateInquiry(
        inquiry.publicUuid,
        status,
        `${this.attentionChannel}: ${this.attentionNote.trim()}`,
        {
          responsibleName: this.responsibleName.trim(),
          nextAttentionDate: this.noteStatus === 'CLOSED' ? null : this.nextAttentionDate || null,
          nextAction: this.noteStatus === 'CLOSED' ? '' : this.nextAction.trim(),
        },
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.noteInquiry.set(null);
          this.formProtection.markSaved();
          this.notice.set('Atención registrada en el historial.');
          this.refresh();
        },
        error: () => {
          this.saving.set(false);
          this.error.set('No se pudo guardar la atención.');
        },
      });
  }

  showHistory(inquiry: AdmissionInquiry): void {
    this.historySubscription?.unsubscribe();
    this.historyLoadingSignal.set(true);
    this.historyErrorSignal.set('');
    this.historyInquiry.set(inquiry);
    this.historyEvents.set([]);
    this.historySubscription = this.api.inquiryHistory(inquiry.publicUuid).subscribe({
      next: (events) => {
        this.historyEvents.set(events);
        this.historyLoadingSignal.set(false);
      },
      error: () => {
        this.historyErrorSignal.set('No se pudo cargar el historial.');
        this.historyLoadingSignal.set(false);
      },
    });
  }

  convert(): void {
    const inquiry = this.convertInquiry();
    if (
      this.saving() ||
      (!inquiry && (!this.presentialOpen() || !this.draftGradeUuid || !this.yearUuid()))
    )
      return;
    this.saving.set(true);
    this.error.set(null);
    const applicant = {
      ...this.draft,
      academicYearPublicUuid: this.draftYearUuid,
      gradePublicUuid: this.draftGradeUuid,
    };
    const request = this.editingSignal()
      ? this.api.updateApplicant(this.editUuid, applicant, this.correctionReason.trim())
      : inquiry
        ? this.api.convertInquiry(inquiry.publicUuid, applicant)
        : this.api.createPresential(this.draftYearUuid, this.draftGradeUuid, applicant);
    request.subscribe({
      next: (response) => {
        this.saving.set(false);
        this.initialDraft = '';
        this.convertInquiry.set(null);
        this.presentialOpen.set(false);
        if (this.canReadApplications())
          void this.router.navigate(['/admissions/applications', response.data.publicUuid], {
            queryParams: { yearId: response.data.academicYearPublicUuid },
          });
        this.notice.set(
          this.editingSignal() ? 'Corrección guardada en el historial.' : 'Solicitud creada.',
        );
        this.refresh();
      },
      error: (error) => {
        this.saving.set(false);
        this.error.set(
          admissionError(
            error,
            'No se pudo crear la solicitud. Verifica los documentos, la fecha y los datos de contacto.',
          ),
        );
      },
    });
  }

  async copyPublicUrl(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.publicFormUrl());
      this.notice.set('Enlace público copiado.');
    } catch {
      this.notice.set('Selecciona y copia el enlace que aparece en la página.');
    }
  }

  statusLabel(status: AdmissionInquiryStatus): string {
    return {
      RECEIVED: 'Pendiente de atención',
      CONTACTED: 'En seguimiento',
      QUALIFIED: 'Calificada',
      CONVERTED: 'Admisión iniciada',
      CLOSED: 'Cerrada',
    }[status];
  }

  statusClass(status: AdmissionInquiryStatus): string {
    if (status === 'QUALIFIED' || status === 'CONVERTED')
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    if (status === 'CLOSED')
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
    if (status === 'CONTACTED')
      return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';
    return 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  }

  private emptyDraft(): CreateAdmissionFromInquiry {
    return {
      source: 'WEBSITE',
      studentDocumentType: 'DNI',
      studentDocumentNumber: '',
      studentFirstName: '',
      studentLastName: '',
      studentSecondLastName: '',
      studentBirthDate: '',
      studentGender: 'NOT_SPECIFIED',
      guardianDocumentType: 'DNI',
      guardianDocumentNumber: '',
      guardianFirstName: '',
      guardianLastName: '',
      guardianEmail: '',
      guardianPhone: '',
      guardianRelationship: 'MOTHER',
    };
  }

  canReadApplications(): boolean {
    return (
      this.auth.hasPermission(Permission.LmsAdmissionManage) ||
      this.auth.hasPermission(Permission.AdmissionsApplicationsRead)
    );
  }
  canReadInquiries(): boolean {
    return (
      this.auth.hasPermission(Permission.LmsAdmissionManage) ||
      this.auth.hasPermission(Permission.AdmissionsInquiriesRead)
    );
  }
  cancelExisting(): void {
    this.formProtection.requestClose(() => {
      this.existingDirtySignal.set(false);
      this.existingStudentSignal.set(false);
      this.formProtection.markSaved();
    });
  }
  openCreated(application: import('../models').AdmissionApplication): void {
    this.existingDirtySignal.set(false);
    this.existingStudentSignal.set(false);
    this.formProtection.markSaved();
    if (this.canReadApplications())
      void this.router.navigate(['/admissions/applications', application.publicUuid], {
        queryParams: { yearId: application.academicYearPublicUuid },
      });
    else
      this.notice.set(
        'Solicitud creada correctamente. El equipo autorizado puede continuar su revisión.',
      );
  }

  canManageInquiries(): boolean {
    return (
      this.auth.hasPermission(Permission.LmsAdmissionManage) ||
      this.auth.hasPermission(Permission.AdmissionsInquiriesManage)
    );
  }

  canFormalize(): boolean {
    return (
      this.auth.hasPermission(Permission.LmsAdmissionManage) ||
      this.auth.hasPermission(Permission.AdmissionsApplicationsManage)
    );
  }
}
