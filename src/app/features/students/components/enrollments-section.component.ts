import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { StudentEnrollmentStatus } from '@core/enums';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { EnrollmentRow, StudentDetail } from '../models';
import { StudentsStore } from '../store';
import { EnrollStudentModalComponent } from './enroll-student-modal.component';
import { WithdrawEnrollmentModalComponent } from './withdraw-enrollment-modal.component';

const STATUS_LABELS: Readonly<Record<StudentEnrollmentStatus, string>> = {
  [StudentEnrollmentStatus.Active]: 'Activa',
  [StudentEnrollmentStatus.Withdrawn]: 'Retirado',
  [StudentEnrollmentStatus.Transferred]: 'Trasladado',
  [StudentEnrollmentStatus.Graduated]: 'Graduado',
};

const STATUS_BADGE_CLASS: Readonly<Record<StudentEnrollmentStatus, string>> = {
  [StudentEnrollmentStatus.Active]: 'badge badge-success',
  [StudentEnrollmentStatus.Withdrawn]: 'badge badge-danger',
  [StudentEnrollmentStatus.Transferred]: 'badge badge-secondary',
  [StudentEnrollmentStatus.Graduated]: 'badge badge-primary',
};

/**
 * Sub-componente del student-detail que cubre el feature
 * "Matrícula" (FE-4.7 / BE-4.8).
 *
 * <h3>Responsabilidades</h3>
 * <ul>
 *   <li>Render de la matrícula <strong>ACTIVE</strong> (si existe)
 *       con la sección, año y fecha.</li>
 *   <li>Acciones: <em>Matricular en sección</em> (cuando no hay
 *       activa), <em>Cambiar sección</em> y <em>Cerrar matrícula</em>
 *       (cuando sí hay).</li>
 *   <li>Tabla con el historial completo, ordenado por
 *       {@code enrolledAt} desc.</li>
 * </ul>
 *
 * <p>El cambio de sección se delega al
 * {@link StudentsStore#transferStudentSection} que encadena withdraw
 * (status TRANSFERRED) + create de la nueva en orden — el modal
 * {@link EnrollStudentModalComponent} maneja ambos casos según se le
 * pase o no el {@code activeEnrollmentPublicUuid}.</p>
 */
@Component({
  selector: 'app-enrollments-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    IconComponent,
    SpinnerComponent,
    EnrollStudentModalComponent,
    WithdrawEnrollmentModalComponent,
  ],
  template: `
    <section class="card lg:col-span-3">
      <header class="card-header">
        <div>
          <h2 class="card-title">Matrícula y sección</h2>
          <p class="card-description">
            Sección activa de {{ student().firstName }} y trazabilidad de cambios entre años
            académicos.
          </p>
        </div>
        <div class="flex items-center gap-2">
          @if (active(); as a) {
            <button
              type="button"
              class="btn btn-outline btn-sm"
              [disabled]="saving()"
              (click)="openTransfer()"
            >
              <app-icon name="arrow-right" [size]="14" />
              <span>Cambiar de sección</span>
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm text-danger-600 hover:bg-danger-50"
              [disabled]="saving()"
              (click)="openWithdraw(a)"
            >
              <app-icon name="x" [size]="14" />
              <span>Cerrar matrícula</span>
            </button>
          } @else {
            <button
              type="button"
              class="btn btn-primary btn-sm"
              [disabled]="saving()"
              (click)="openEnroll()"
            >
              <app-icon name="plus" [size]="14" />
              <span>Matricular en sección</span>
            </button>
          }
        </div>
      </header>

      <div class="card-body flex flex-col gap-4">
        @if (loading()) {
          <div class="flex items-center justify-center py-6">
            <app-spinner [size]="20" label="Cargando matrícula…" />
          </div>
        } @else if (errorMessage()) {
          <div class="alert alert-danger">
            <app-icon name="alert-circle" [size]="18" />
            <p class="flex-1 text-sm">{{ errorMessage() }}</p>
            <button type="button" class="btn btn-ghost btn-sm" (click)="reload()">
              Reintentar
            </button>
          </div>
        } @else {
          @if (active(); as a) {
            <div
              class="grid gap-3 rounded-lg border border-border-subtle bg-surface-muted px-4 py-3 sm:grid-cols-3"
            >
              <div>
                <p class="text-2xs uppercase tracking-wider text-content-subtle">Sección actual</p>
                <a
                  [routerLink]="sectionRoute(a.sectionPublicUuid)"
                  class="mt-1 inline-flex items-center gap-1 text-sm font-medium text-content hover:underline"
                >
                  {{ a.sectionName }}
                  <app-icon name="arrow-right" [size]="12" />
                </a>
              </div>
              <div>
                <p class="text-2xs uppercase tracking-wider text-content-subtle">Año académico</p>
                <p class="mt-1 text-sm text-content">
                  {{ a.academicYearName }}
                </p>
              </div>
              <div>
                <p class="text-2xs uppercase tracking-wider text-content-subtle">Matriculado el</p>
                <p class="mt-1 text-sm text-content">
                  {{ a.enrolledAt ? (a.enrolledAt | date: 'mediumDate') : '—' }}
                </p>
              </div>
            </div>
          } @else {
            <div class="rounded-lg border border-dashed border-border-subtle px-4 py-6 text-center">
              <app-icon name="info" [size]="20" class="mx-auto mb-2 text-content-subtle" />
              <p class="text-sm font-medium text-content">Sin matrícula activa</p>
              <p class="mt-1 text-xs text-content-muted">
                Asigna una sección para que aparezca en el roster del año activo.
              </p>
            </div>
          }

          @if (rows().length > 0) {
            <div>
              <h3 class="mb-2 text-sm font-semibold text-content">Historial de matrículas</h3>
              <div class="overflow-x-auto">
                <table class="table">
                  <thead>
                    <tr>
                      <th scope="col">Sección</th>
                      <th scope="col">Año</th>
                      <th scope="col">Matriculado</th>
                      <th scope="col">Cierre</th>
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (e of rows(); track e.publicUuid) {
                      <tr>
                        <td>
                          <a
                            [routerLink]="sectionRoute(e.sectionPublicUuid)"
                            class="font-medium hover:underline"
                          >
                            {{ e.sectionName }}
                          </a>
                        </td>
                        <td>
                          <span class="text-xs text-content-muted">
                            {{ e.academicYearName }}
                          </span>
                        </td>
                        <td>
                          <span class="text-xs text-content-muted">
                            {{ e.enrolledAt ? (e.enrolledAt | date: 'mediumDate') : '—' }}
                          </span>
                        </td>
                        <td>
                          <span class="text-xs text-content-muted">
                            {{ e.withdrawnAt ? (e.withdrawnAt | date: 'mediumDate') : '—' }}
                          </span>
                        </td>
                        <td>
                          <span [class]="badgeClass(e.status)">
                            {{ statusLabel(e.status) }}
                          </span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        }
      </div>
    </section>

    @if (showEnroll()) {
      <app-enroll-student-modal
        [student]="student()"
        (closed)="closeEnroll()"
        (enrolled)="onEnrolled()"
      />
    }
    @if (showTransfer() && active(); as activeRow) {
      <app-enroll-student-modal
        [student]="student()"
        [activeEnrollmentPublicUuid]="activeRow.publicUuid"
        [currentSectionUuid]="activeRow.sectionPublicUuid"
        (closed)="closeTransfer()"
        (enrolled)="onTransferred()"
      />
    }
    @if (withdrawTarget(); as target) {
      <app-withdraw-enrollment-modal
        [enrollment]="target"
        (closed)="closeWithdraw()"
        (withdrew)="onWithdrew()"
      />
    }
  `,
})
export class EnrollmentsSectionComponent implements OnInit {
  private readonly store = inject(StudentsStore);

  readonly student = input.required<StudentDetail>();

  protected readonly rows = this.store.enrollments;
  protected readonly active = this.store.activeEnrollment;
  protected readonly loading = this.store.loadingEnrollments;
  protected readonly saving = this.store.savingEnrollment;
  protected readonly errorMessage = this.store.error;

  protected readonly showEnroll = signal<boolean>(false);
  protected readonly showTransfer = signal<boolean>(false);
  protected readonly withdrawTarget = signal<EnrollmentRow | null>(null);

  /** Snapshot del student.publicUuid para el cleanup en cambio de detail. */
  protected readonly studentUuid = computed<string>(() => this.student().publicUuid);

  async ngOnInit(): Promise<void> {
    await this.store.loadEnrollments(this.studentUuid());
  }

  protected sectionRoute(sectionUuid: string): string {
    return ROUTES.ACADEMIC.SECTIONS.detail(sectionUuid);
  }

  protected statusLabel(s: StudentEnrollmentStatus): string {
    return STATUS_LABELS[s];
  }

  protected badgeClass(s: StudentEnrollmentStatus): string {
    return STATUS_BADGE_CLASS[s];
  }

  protected async reload(): Promise<void> {
    this.store.clearError();
    await this.store.loadEnrollments(this.studentUuid());
  }

  // ----- modal handlers -----

  protected openEnroll(): void {
    this.store.clearError();
    this.showEnroll.set(true);
  }

  protected closeEnroll(): void {
    this.showEnroll.set(false);
  }

  protected onEnrolled(): void {
    this.showEnroll.set(false);
  }

  protected openTransfer(): void {
    this.store.clearError();
    this.showTransfer.set(true);
  }

  protected closeTransfer(): void {
    this.showTransfer.set(false);
  }

  protected onTransferred(): void {
    this.showTransfer.set(false);
  }

  protected openWithdraw(active: EnrollmentRow): void {
    this.store.clearError();
    this.withdrawTarget.set(active);
  }

  protected closeWithdraw(): void {
    this.withdrawTarget.set(null);
  }

  protected onWithdrew(): void {
    this.withdrawTarget.set(null);
  }
}
