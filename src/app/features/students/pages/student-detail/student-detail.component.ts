import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import {
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import {
  EnrollmentStatusBadgeComponent,
  EnrollmentsSectionComponent,
  GuardiansSectionComponent,
} from '../../components';
import { StudentsStore } from '../../store';
import { StudentDetail } from '../../models';

/**
 * `/students/:id` — read-only detail page.
 *
 * <h3>Why this is intentionally lean</h3>
 * Sprint 3 keeps the detail view focused on identity + contact +
 * enrolment. Tutors land in {@code FE-3.5} as a dedicated section
 * on this same page; until then the layout has a placeholder card
 * pointing at that gap so admins know it is coming, not missing.
 *
 * <h3>Actions</h3>
 * Edit links to {@code /students/:id/edit} (the
 * {@link StudentFormComponent} in update mode). Delete fires a
 * confirmation dialog and routes back to the list on success — the
 * store handles the optimistic row removal.
 */
@Component({
  selector: 'app-student-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    IconComponent,
    SpinnerComponent,
    EnrollmentStatusBadgeComponent,
    EnrollmentsSectionComponent,
    GuardiansSectionComponent,
  ],
  template: `
    <app-page-container size="default">
      @if (student(); as s) {
        <app-page-header
          eyebrow="Detalle de estudiante"
          [title]="s.fullName"
          [subtitle]="documentLabel(s)"
        >
          <a [routerLink]="listRoute" class="btn btn-ghost btn-sm">
            <app-icon name="arrow-left" [size]="16" />
            <span class="hidden sm:inline">Volver</span>
          </a>
          <a [routerLink]="editLink(s.publicUuid)" class="btn btn-outline btn-sm">
            <app-icon name="pencil" [size]="16" />
            <span class="hidden sm:inline">Editar</span>
          </a>
          <button
            type="button"
            class="btn btn-danger btn-sm"
            [disabled]="saving()"
            (click)="onDelete(s)"
          >
            @if (saving()) {
              <app-spinner [size]="14" label="Eliminando" />
            } @else {
              <app-icon name="trash" [size]="16" />
            }
            <span class="hidden sm:inline">Eliminar</span>
          </button>
        </app-page-header>

        <div class="grid gap-4 lg:grid-cols-3">
          <section class="card lg:col-span-2">
            <header class="card-header">
              <h2 class="card-title">Identidad</h2>
              <p class="card-description">Datos demográficos del estudiante.</p>
            </header>
            <div class="card-body grid gap-4 sm:grid-cols-2">
              <div>
                <p class="text-2xs uppercase tracking-wider text-content-subtle">Nombres</p>
                <p class="text-sm text-content">{{ s.firstName }}</p>
              </div>
              <div>
                <p class="text-2xs uppercase tracking-wider text-content-subtle">Apellidos</p>
                <p class="text-sm text-content">
                  {{ s.lastName }}{{ s.secondLastName ? ' ' + s.secondLastName : '' }}
                </p>
              </div>
              <div>
                <p class="text-2xs uppercase tracking-wider text-content-subtle">Documento</p>
                <p class="text-sm text-content">
                  <span class="font-mono text-xs">{{ s.documentType }}</span>
                  <span class="ml-2">{{ s.documentNumber }}</span>
                </p>
              </div>
              <div>
                <p class="text-2xs uppercase tracking-wider text-content-subtle">Género</p>
                <p class="text-sm text-content">{{ formatGender(s.gender) }}</p>
              </div>
              <div>
                <p class="text-2xs uppercase tracking-wider text-content-subtle">Nacimiento</p>
                <p class="text-sm text-content">{{ formatDate(s.birthDate) }}</p>
              </div>
              <div>
                <p class="text-2xs uppercase tracking-wider text-content-subtle">Edad</p>
                <p class="text-sm text-content">{{ ageText(s.birthDate) }}</p>
              </div>
            </div>
          </section>

          <section class="card">
            <header class="card-header">
              <h2 class="card-title">Matrícula</h2>
              <p class="card-description">Estado dentro de la institución.</p>
            </header>
            <div class="card-body grid gap-3">
              <div>
                <p class="text-2xs uppercase tracking-wider text-content-subtle">Estado</p>
                <div class="mt-1">
                  <app-enrollment-status-badge [status]="s.enrollmentStatus" />
                </div>
              </div>
              <div>
                <p class="text-2xs uppercase tracking-wider text-content-subtle">Fecha</p>
                <p class="text-sm text-content">{{ formatDate(s.enrollmentDate) }}</p>
              </div>
              @if (s.userId) {
                <div>
                  <p class="text-2xs uppercase tracking-wider text-content-subtle">Cuenta</p>
                  <p class="font-mono text-xs text-content-muted">{{ s.userId }}</p>
                </div>
              }
            </div>
          </section>

          <section class="card lg:col-span-3">
            <header class="card-header">
              <h2 class="card-title">Contacto</h2>
              <p class="card-description">Email, teléfono y dirección.</p>
            </header>
            <div class="card-body grid gap-4 sm:grid-cols-3">
              <div>
                <p class="text-2xs uppercase tracking-wider text-content-subtle">Email</p>
                <p class="break-all text-sm text-content">{{ s.email ?? '—' }}</p>
              </div>
              <div>
                <p class="text-2xs uppercase tracking-wider text-content-subtle">Teléfono</p>
                <p class="text-sm text-content">{{ s.phone ?? '—' }}</p>
              </div>
              <div>
                <p class="text-2xs uppercase tracking-wider text-content-subtle">Dirección</p>
                <p class="text-sm text-content">{{ s.address ?? '—' }}</p>
              </div>
            </div>
          </section>

          <app-enrollments-section [student]="s" />

          <app-guardians-section [studentPublicUuid]="s.publicUuid" />

          <section class="card lg:col-span-3">
            <header class="card-header">
              <h2 class="card-title">Auditoría</h2>
            </header>
            <div class="card-body grid gap-4 sm:grid-cols-2">
              <div>
                <p class="text-2xs uppercase tracking-wider text-content-subtle">Creado</p>
                <p class="text-sm text-content">{{ formatDateTime(s.createdAt) }}</p>
              </div>
              <div>
                <p class="text-2xs uppercase tracking-wider text-content-subtle">Última edición</p>
                <p class="text-sm text-content">{{ formatDateTime(s.updatedAt) }}</p>
              </div>
            </div>
          </section>
        </div>
      } @else if (loading()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando estudiante…" />
        </div>
      } @else {
        <div class="card">
          <div class="card-body alert alert-danger">
            <app-icon name="alert-circle" [size]="18" />
            <div class="flex-1">
              <p class="font-medium">No pudimos cargar el estudiante.</p>
              <p class="mt-1 text-xs opacity-80">
                {{ errorMessage() ?? 'Recurso no encontrado.' }}
              </p>
            </div>
            <a [routerLink]="listRoute" class="btn btn-ghost btn-sm">Volver al listado</a>
          </div>
        </div>
      }
    </app-page-container>
  `,
})
export class StudentDetailComponent implements OnInit {
  private readonly store = inject(StudentsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly listRoute = ROUTES.STUDENTS.LIST;

  protected readonly student = this.store.selected;
  protected readonly loading = this.store.loadingDetail;
  protected readonly saving = this.store.saving;
  protected readonly errorMessage = this.store.error;

  /** Tracks the public UUID we are showing so navigations refresh the load. */
  private readonly currentId = signal<string | null>(null);

  protected readonly fullName = computed(() => this.student()?.fullName ?? '');

  ngOnInit(): void {
    this.store.clearError();
    const id = this.route.snapshot.paramMap.get('id');
    this.currentId.set(id);
    if (id) {
      void this.store.loadDetail(id);
    }
  }

  protected editLink(publicUuid: string): string {
    return ROUTES.STUDENTS.edit(publicUuid);
  }

  protected documentLabel(s: StudentDetail): string {
    return `${s.documentType} · ${s.documentNumber}`;
  }

  protected formatGender(gender: StudentDetail['gender']): string {
    if (!gender) return '—';
    switch (gender) {
      case 'MALE':
        return 'Masculino';
      case 'FEMALE':
        return 'Femenino';
      case 'OTHER':
        return 'Otro';
      case 'NOT_SPECIFIED':
        return 'Sin especificar';
      default:
        return gender;
    }
  }

  protected formatDate(date: Date | undefined): string {
    if (!date) return '—';
    return date.toLocaleDateString('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  protected formatDateTime(date: Date | undefined): string {
    if (!date) return '—';
    return date.toLocaleString('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** Approximate age in years; null when birthDate is unknown. */
  protected ageText(birthDate: Date | undefined): string {
    if (!birthDate) return '—';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDelta = today.getMonth() - birthDate.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 0 || age > 120) return '—';
    return `${age} años`;
  }

  protected async onDelete(student: StudentDetail): Promise<void> {
    /* No fancy modal yet — Sprint 3 ships a native confirm() so we
     * don't bikeshed the dialog component while the rest of the
     * flow stabilizes. Promote to {@code app-confirm-dialog} the
     * second another delete flow lands. */
    const ok = window.confirm(
      `¿Eliminar a ${student.fullName}? Esta acción es reversible (soft delete).`,
    );
    if (!ok) return;

    const success = await this.store.delete(student.publicUuid);
    if (success) {
      await this.router.navigate([ROUTES.STUDENTS.LIST]);
    }
  }
}
