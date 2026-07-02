import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminActionKind, AdminActionResult } from '../../store/admin-payments.store';
import { Payment } from '../../models/invoice.model';

/**
 * Admin payment action modal (Sprint 11 / FE-11.2).
 *
 * <p>One modal, three modes:
 * <ul>
 *   <li><strong>reconcile</strong> — request a reason; backend flips
 *       PENDING/IN_PROCESS → APPROVED.</li>
 *   <li><strong>refund</strong> — request a reason; backend flips
 *       APPROVED → REFUNDED.</li>
 *   <li><strong>mark-paid-cash</strong> — optional note; backend
 *       creates a CASH payment and flips the invoice to PAID.</li>
 * </ul>
 *
 * <p>The form is generic; per-mode validation, labels and the action
 * button text come from {@link #copy}. The parent provides the
 * {@link Payment} (or invoice context for {@code mark-paid-cash})
 * and listens to {@code submit} for the actual call.</p>
 */
@Component({
  selector: 'app-admin-payment-action-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="titleId"
      (click)="onBackdropClick($event)"
    >
      <!-- Card -->
      <div
        class="w-full overflow-hidden rounded-t-2xl bg-white shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:max-w-md sm:rounded-2xl"
        (click)="$event.stopPropagation()"
      >
        <header class="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 [id]="titleId" class="text-base font-semibold text-slate-900 dark:text-slate-100">
            {{ copy().title }}
          </h2>
          @if (payment) {
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Pago <span class="font-mono">{{ payment.publicUuid }}</span> · {{ payment.currency }}
              {{ payment.amountCents / 100 | number: '1.2-2' }} · estado {{ payment.status }}
            </p>
          }
        </header>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4 px-5 py-4">
          <p class="text-sm text-slate-600 dark:text-slate-300">
            {{ copy().body }}
          </p>

          @if (requiresReason()) {
            <label class="block">
              <span class="text-xs font-medium text-slate-700 dark:text-slate-300">
                Motivo <span class="text-rose-500">*</span>
              </span>
              <textarea
                rows="3"
                formControlName="reason"
                [attr.placeholder]="copy().reasonPlaceholder"
                class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                [attr.aria-invalid]="form.controls.reason.invalid"
              ></textarea>
              @if (form.controls.reason.touched && form.controls.reason.errors) {
                <span class="mt-1 block text-xs text-rose-600">
                  El motivo es obligatorio (mínimo 4 caracteres).
                </span>
              }
            </label>
          } @else {
            <label class="block">
              <span class="text-xs font-medium text-slate-700 dark:text-slate-300">
                Nota (opcional)
              </span>
              <input
                type="text"
                formControlName="note"
                placeholder="Ej: Cobrado en administración"
                class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
          }

          @if (lastResult && !lastResult.ok) {
            <p class="text-xs text-rose-600">
              {{ lastResult.message }}
            </p>
          }

          <footer class="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              (click)="actionCancel.emit()"
              [disabled]="submitting"
            >
              Cancelar
            </button>
            <button
              type="submit"
              [class]="copy().submitClass + ' btn btn-sm'"
              [disabled]="form.invalid || submitting"
            >
              @if (submitting) {
                <span class="loading loading-spinner loading-xs"></span>
              }
              {{ copy().submitLabel }}
            </button>
          </footer>
        </form>
      </div>
    </div>
  `,
})
export class AdminPaymentActionModalComponent implements OnChanges {
  private readonly fb = new FormBuilder().nonNullable;

  /** Which action this modal is rendering for. Drives labels & validation. */
  @Input({ required: true }) kind!: AdminActionKind;

  /** The payment being acted on. Null only for `mark-paid-cash` (invoice-level). */
  @Input() payment: Payment | null = null;

  /** External submit signal — when true, disables the submit button. */
  @Input() submitting = false;

  /** Last result (if any) used to surface server errors inline. */
  @Input() lastResult: AdminActionResult | null = null;

  @Output() actionSubmit = new EventEmitter<{ reason?: string; note?: string }>();
  @Output() actionCancel = new EventEmitter<void>();

  readonly titleId = `admin-action-${Math.random().toString(36).slice(2, 9)}`;

  // Reactive form. Only one of the two controls is meaningful per mode,
  // but we keep both so the template can branch cleanly.
  readonly form = this.fb.group({
    reason: ['', [Validators.required, Validators.minLength(4)]],
    note: [''],
  });

  /** Live signal mirror of `submitting` so the template can render the spinner. */
  private readonly _submitting = signal(false);
  readonly submittingSig = this._submitting.asReadonly();

  /** `reconcile` and `refund` require a reason; `mark-paid-cash` does not. */
  requiresReason = computed(() => this.kind === 'reconcile' || this.kind === 'refund');

  /** Mode-specific copy. Re-derived whenever the input changes. */
  copy = computed(() => this.copyFor(this.kind));

  ngOnChanges(changes: SimpleChanges): void {
    // Reset the form on mode switch so a previous reason doesn't bleed
    // into a different action.
    this.form.reset({ reason: '', note: '' });
    // Dynamically manage the reason validator based on the mode.
    const reasonCtrl = this.form.controls.reason;
    if (this.requiresReason()) {
      reasonCtrl.setValidators([Validators.required, Validators.minLength(4)]);
    } else {
      reasonCtrl.clearValidators();
    }
    reasonCtrl.updateValueAndValidity();
  }

  onBackdropClick(e: MouseEvent): void {
    // Click on the dimmed backdrop (not the card body) dismisses.
    if (e.target === e.currentTarget) this.actionCancel.emit();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    if (this.requiresReason()) {
      this.actionSubmit.emit({ reason: raw.reason });
    } else {
      this.actionSubmit.emit({ note: raw.note || undefined });
    }
  }

  private copyFor(kind: AdminActionKind): ActionCopy {
    switch (kind) {
      case 'reconcile':
        return {
          title: 'Conciliar pago',
          body: 'Forzar la aprobación de este pago aunque el proveedor no haya notificado. Quedará registrado en auditoría.',
          reasonPlaceholder: 'Ej: webhook duplicado, monto conciliado manualmente',
          submitLabel: 'Conciliar',
          submitClass: 'btn-primary',
        };
      case 'refund':
        return {
          title: 'Reembolsar pago',
          body: 'Marca el pago como REFUNDED y deja la factura en estado REFUNDED. Esta acción no procesa dinero, solo registra el estado.',
          reasonPlaceholder: 'Ej: cobro duplicado, error administrativo',
          submitLabel: 'Reembolsar',
          submitClass: 'btn-warning',
        };
      case 'mark-paid-cash':
        return {
          title: 'Marcar pagada en efectivo',
          body: 'Crea un pago en CASH por el saldo de la factura y la marca como PAID.',
          reasonPlaceholder: '',
          submitLabel: 'Marcar pagada',
          submitClass: 'btn-primary',
        };
    }
  }
}

interface ActionCopy {
  title: string;
  body: string;
  reasonPlaceholder: string;
  submitLabel: string;
  submitClass: string;
}
