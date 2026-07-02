import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { StudentEnrollmentStatus, TERMINAL_ENROLLMENT_STATUSES } from '@core/enums';
import { EnrollmentRow } from '../models';
import { StudentsStore } from '../store';

const STATUS_LABELS: Readonly<Record<StudentEnrollmentStatus, string>> = {
  [StudentEnrollmentStatus.Active]: 'Activo',
  [StudentEnrollmentStatus.Withdrawn]: 'Retirado',
  [StudentEnrollmentStatus.Transferred]: 'Trasladado',
  [StudentEnrollmentStatus.Graduated]: 'Graduado',
};

const STATUS_DESCRIPTIONS: Readonly<Record<StudentEnrollmentStatus, string>> = {
  [StudentEnrollmentStatus.Active]: '',
  [StudentEnrollmentStatus.Withdrawn]:
    'El estudiante deja la institución por iniciativa propia o de la familia.',
  [StudentEnrollmentStatus.Transferred]:
    'El estudiante se traslada a otra escuela. Si solo cambia de sección dentro de esta institución, usa el flujo "Cambiar de sección".',
  [StudentEnrollmentStatus.Graduated]: 'El estudiante terminó el ciclo. Estado terminal.',
};

/**
 * Dialog "Retirar / Trasladar / Graduar" — soft-end de una matrícula
 * activa (BE-4.8).
 *
 * <p>El back rechaza {@code status = ACTIVE} con 400
 * {@code INVALID_WITHDRAW_STATUS}; por eso el dropdown solo expone los
 * tres terminales válidos. La fecha default es hoy y el back valida
 * que sea {@code >= enrolledAt} (lo respeta el {@code min} del
 * input).</p>
 */
@Component({
  selector: 'app-withdraw-enrollment-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IconComponent, SpinnerComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="withdraw-title"
      (click)="onBackdropClick($event)"
    >
      <div
        class="card flex max-h-[90vh] w-full max-w-lg flex-col shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <header class="card-header">
          <div>
            <h2 id="withdraw-title" class="card-title">Cerrar matrícula</h2>
            <p class="card-description">
              Cierra la matrícula activa de
              <strong>{{ enrollment().sectionName }}</strong>
              ({{ enrollment().academicYearName }}). Esta acción no es reversible.
            </p>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-icon"
            aria-label="Cerrar"
            (click)="close()"
          >
            <app-icon name="x" [size]="18" />
          </button>
        </header>

        <div class="card-body flex flex-col gap-3 overflow-y-auto">
          @if (errorMessage(); as err) {
            <div class="alert alert-danger">
              <app-icon name="alert-circle" [size]="18" />
              <p class="flex-1 text-sm">{{ err }}</p>
            </div>
          }

          <div class="field">
            <label class="label" for="withdraw-status">
              Motivo / estado <span class="text-danger-500">*</span>
            </label>
            <select
              id="withdraw-status"
              class="select"
              [ngModel]="status()"
              (ngModelChange)="status.set($event)"
              [disabled]="saving()"
            >
              @for (s of terminalStatuses; track s) {
                <option [value]="s">{{ statusLabel(s) }}</option>
              }
            </select>
            @if (statusDescription()) {
              <p class="hint mt-1 text-xs text-content-muted">
                {{ statusDescription() }}
              </p>
            }
          </div>

          <div class="field">
            <label class="label" for="withdraw-date">
              Fecha de cierre <span class="text-danger-500">*</span>
            </label>
            <input
              id="withdraw-date"
              type="date"
              class="input"
              [min]="minDate()"
              [ngModel]="withdrawnAt()"
              (ngModelChange)="withdrawnAt.set($event)"
              [disabled]="saving()"
            />
            <p class="hint mt-1 text-xs text-content-muted">
              Debe ser posterior o igual a la fecha de matrícula ({{ minDate() }}).
            </p>
          </div>
        </div>

        <footer class="card-footer">
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            [disabled]="saving()"
            (click)="close()"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-danger btn-sm"
            [disabled]="!canSubmit() || saving()"
            (click)="onSubmit()"
          >
            @if (saving()) {
              <app-spinner [size]="14" />
            }
            <span>Confirmar</span>
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class WithdrawEnrollmentModalComponent implements OnInit {
  private readonly store = inject(StudentsStore);

  readonly enrollment = input.required<EnrollmentRow>();

  readonly closed = output<void>();
  readonly withdrew = output<void>();

  protected readonly saving = this.store.savingEnrollment;
  protected readonly errorMessage = this.store.error;

  protected readonly terminalStatuses = TERMINAL_ENROLLMENT_STATUSES;

  protected readonly status = signal<StudentEnrollmentStatus>(StudentEnrollmentStatus.Withdrawn);
  protected readonly withdrawnAt = signal<string>('');

  protected readonly minDate = computed<string>(() => {
    const e = this.enrollment().enrolledAt;
    return e ? this.toIsoDate(e) : '';
  });

  protected readonly statusDescription = computed<string>(
    () => STATUS_DESCRIPTIONS[this.status()] ?? '',
  );

  protected readonly canSubmit = computed<boolean>(() => {
    if (!this.status() || !this.withdrawnAt()) return false;
    const min = this.minDate();
    return !min || this.withdrawnAt() >= min;
  });

  ngOnInit(): void {
    this.store.clearError();
    const today = this.toIsoDate(new Date());
    const min = this.minDate();
    this.withdrawnAt.set(min && today < min ? min : today);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.saving()) this.close();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.saving()) this.close();
  }

  protected close(): void {
    this.store.clearError();
    this.closed.emit();
  }

  protected statusLabel(s: StudentEnrollmentStatus): string {
    return STATUS_LABELS[s];
  }

  protected async onSubmit(): Promise<void> {
    if (!this.canSubmit() || this.saving()) return;
    const result = await this.store.withdrawEnrollment(this.enrollment().publicUuid, {
      status: this.status(),
      withdrawnAt: this.withdrawnAt(),
    });
    if (result) this.withdrew.emit();
  }

  private toIsoDate(value: Date | string): string {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
