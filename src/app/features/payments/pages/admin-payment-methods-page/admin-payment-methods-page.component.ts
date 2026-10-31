import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentsApiService } from '../../services/payments-api.service';
import {
  PaymentMethodAdminResponse,
  PaymentMethodType,
  PaymentMethodUpdateRequest,
  getMethodTypeIcon,
  getPaymentMethodImage,
  getMethodTypeLabel,
} from '../../models/payment-method.model';

/**
 * Admin page for the tenant's own payment methods (cuenta bancaria,
 * Yape, Plin) — the data guardians read to pay an invoice.
 */
@Component({
  selector: 'app-admin-payment-methods-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <header class="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
            Métodos de pago del colegio
          </h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Así podrán pagar los apoderados. Se muestra en el detalle de cada cuota.
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          (click)="openCreate()"
        >
          Agregar método
        </button>
      </header>

      @if (error()) {
        <div class="mb-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {{ error() }}
        </div>
      }

      @if (loading()) {
        <p class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
      } @else if (methods().length === 0) {
        <div class="border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-700">
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Todavía no configuraste métodos de pago.
          </p>
          <button
            type="button"
            class="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            (click)="openCreate()"
          >
            Agregar el primero
          </button>
        </div>
      } @else {
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (m of methods(); track m.publicUuid) {
            <article
              class="rounded-md border border-slate-300 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <div class="flex items-start gap-3">
                @if (methodImageOf(m.methodType, m.bankName); as image) {
                  <img
                    [src]="image"
                    [alt]="labelOf(m.methodType)"
                    class="h-12 w-12 shrink-0 rounded-md bg-white object-contain"
                  />
                } @else {
                  <span class="text-2xl leading-none">{{ iconOf(m.methodType) }}</span>
                }
                <div class="min-w-0 flex-1">
                  <p class="truncate font-medium text-slate-900 dark:text-slate-100">
                    {{ m.displayName || labelOf(m.methodType) }}
                  </p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {{ labelOf(m.methodType) }}
                  </p>
                </div>
              </div>

              <dl class="mt-3 space-y-1 text-sm">
                @if (m.bankName) {
                  <div class="flex justify-between gap-3">
                    <dt class="text-slate-500 dark:text-slate-400">Banco</dt>
                    <dd class="font-medium text-slate-900 dark:text-slate-100">{{ m.bankName }}</dd>
                  </div>
                }
                @if (m.accountHolder) {
                  <div class="flex justify-between gap-3">
                    <dt class="text-slate-500 dark:text-slate-400">Titular</dt>
                    <dd class="truncate font-medium text-slate-900 dark:text-slate-100">
                      {{ m.accountHolder }}
                    </dd>
                  </div>
                }
                @if (m.accountNumber) {
                  <div class="flex items-center justify-between gap-3">
                    <dt class="text-slate-500 dark:text-slate-400">Cuenta</dt>
                    <dd class="flex items-center gap-1">
                      <span class="font-mono font-medium text-slate-900 dark:text-slate-100">
                        {{ m.accountNumber }}
                      </span>
                      <button
                        type="button"
                        class="rounded p-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Copiar"
                        (click)="copy(m.accountNumber)"
                      >
                        📋
                      </button>
                    </dd>
                  </div>
                }
                @if (m.cci) {
                  <div class="flex items-center justify-between gap-3">
                    <dt class="text-slate-500 dark:text-slate-400">CCI</dt>
                    <dd class="flex items-center gap-1">
                      <span class="font-mono font-medium text-slate-900 dark:text-slate-100">
                        {{ m.cci }}
                      </span>
                      <button
                        type="button"
                        class="rounded p-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Copiar"
                        (click)="copy(m.cci)"
                      >
                        📋
                      </button>
                    </dd>
                  </div>
                }
                @if (m.walletPhone) {
                  <div class="flex items-center justify-between gap-3">
                    <dt class="text-slate-500 dark:text-slate-400">Teléfono</dt>
                    <dd class="flex items-center gap-1">
                      <span class="font-mono font-medium text-slate-900 dark:text-slate-100">
                        {{ m.walletPhone }}
                      </span>
                      <button
                        type="button"
                        class="rounded p-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Copiar"
                        (click)="copy(m.walletPhone)"
                      >
                        📋
                      </button>
                    </dd>
                  </div>
                }
              </dl>

              @if (m.walletQrUrl) {
                <img
                  [src]="m.walletQrUrl"
                  alt="QR de pago"
                  class="mt-3 h-32 w-32 rounded-md border border-slate-200 bg-white object-contain"
                />
              }

              <div class="mt-4 flex flex-wrap gap-2">
                @if (m.defaultMethod) {
                  <span
                    class="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800"
                  >
                    Principal
                  </span>
                } @else {
                  <button
                    type="button"
                    class="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    (click)="setDefault(m.publicUuid)"
                  >
                    Marcar principal
                  </button>
                }
                <button
                  type="button"
                  class="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  (click)="openEdit(m)"
                >
                  Editar
                </button>
                <button
                  type="button"
                  class="rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950"
                  (click)="remove(m)"
                >
                  Eliminar
                </button>
              </div>
            </article>
          }
        </div>
      }
    </section>

    @if (formOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        (click)="closeForm()"
      >
        <div
          class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-slate-900"
          role="dialog"
          aria-modal="true"
          (click)="$event.stopPropagation()"
        >
          <h2 class="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {{ editingId() ? 'Editar método' : 'Agregar método de pago' }}
          </h2>

          <form class="space-y-4" (ngSubmit)="submit()">
            <label class="block">
              <span class="text-xs font-medium text-slate-700 dark:text-slate-300">Tipo</span>
              <select
                name="methodType"
                [ngModel]="form.methodType"
                (ngModelChange)="form.methodType = $event"
                [disabled]="!!editingId()"
                class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                required
              >
                <option value="BANK_TRANSFER">Transferencia bancaria</option>
                <option value="YAPE">Yape</option>
                <option value="PLIN">Plin</option>
                <option value="CASH">Efectivo</option>
              </select>
            </label>

            @if (form.methodType === 'BANK_TRANSFER') {
              <label class="block">
                <span class="text-xs font-medium text-slate-700 dark:text-slate-300">Banco</span>
                <input
                  name="bankName"
                  type="text"
                  [(ngModel)]="form.bankName"
                  placeholder="BCP, BBVA, Interbank…"
                  class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label class="block">
                <span class="text-xs font-medium text-slate-700 dark:text-slate-300">Titular</span>
                <input
                  name="accountHolder"
                  type="text"
                  [(ngModel)]="form.accountHolder"
                  placeholder="Colegio San Juan SAC"
                  class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label class="block">
                <span class="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Número de cuenta
                </span>
                <input
                  name="accountNumber"
                  type="text"
                  [(ngModel)]="form.accountNumber"
                  placeholder="191-1234567890-0123 o 1234567890123"
                  class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <span class="field-hint">13 a 18 dígitos, con o sin guiones.</span>
              </label>
              <label class="block">
                <span class="text-xs font-medium text-slate-700 dark:text-slate-300">CCI</span>
                <input
                  name="cci"
                  type="text"
                  [(ngModel)]="form.cci"
                  placeholder="00219112345678901234"
                  class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <span class="field-hint">20 dígitos (opcional).</span>
              </label>
            }

            @if (form.methodType === 'YAPE' || form.methodType === 'PLIN') {
              <label class="block">
                <span class="text-xs font-medium text-slate-700 dark:text-slate-300">Teléfono</span>
                <input
                  name="walletPhone"
                  type="tel"
                  inputmode="numeric"
                  [(ngModel)]="form.walletPhone"
                  placeholder="912345678"
                  class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <span class="field-hint">9 dígitos, empieza con 9.</span>
              </label>
              <label class="block">
                <span class="text-xs font-medium text-slate-700 dark:text-slate-300">URL del QR</span>
                <input
                  name="walletQrUrl"
                  type="url"
                  [(ngModel)]="form.walletQrUrl"
                  placeholder="https://… (opcional)"
                  class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            }

            <label class="block">
              <span class="text-xs font-medium text-slate-700 dark:text-slate-300">
                Nombre visible para los padres
              </span>
              <input
                name="displayName"
                type="text"
                [(ngModel)]="form.displayName"
                placeholder="Cuenta BCP, Yape del colegio…"
                class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>

            @if (formError()) {
              <p class="text-sm text-rose-600">{{ formError() }}</p>
            }

            <div class="flex gap-3 pt-2">
              <button
                type="button"
                class="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                (click)="closeForm()"
              >
                Cancelar
              </button>
              <button
                type="submit"
                [disabled]="saving()"
                class="flex-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {{ saving() ? 'Guardando…' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class AdminPaymentMethodsPageComponent implements OnInit {
  private readonly api = inject(PaymentsApiService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly methods = signal<PaymentMethodAdminResponse[]>([]);

  protected readonly methodTypes: readonly PaymentMethodType[] = [
    'BANK_TRANSFER',
    'YAPE',
    'PLIN',
    'CASH',
  ];

  protected form: {
    methodType: PaymentMethodType;
    displayName: string | null;
    bankName: string | null;
    accountHolder: string | null;
    accountNumber: string | null;
    cci: string | null;
    walletPhone: string | null;
    walletQrUrl: string | null;
  } = this.blankForm();

  protected readonly isBank = computed(() => this.form.methodType === 'BANK_TRANSFER');
  protected readonly isWallet = computed(
    () => this.form.methodType === 'YAPE' || this.form.methodType === 'PLIN',
  );

  ngOnInit(): void {
    this.load();
  }

  protected iconOf(type: PaymentMethodType): string {
    return getMethodTypeIcon(type);
  }

  protected methodImageOf(type: PaymentMethodType, bankName?: string | null): string | null {
    return getPaymentMethodImage(type, bankName);
  }

  protected labelOf(type: PaymentMethodType): string {
    return getMethodTypeLabel(type);
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.form = this.blankForm();
    this.formError.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(m: PaymentMethodAdminResponse): void {
    this.editingId.set(m.publicUuid);
    this.form = {
      methodType: m.methodType,
      displayName: m.displayName,
      bankName: m.bankName,
      accountHolder: m.accountHolder,
      accountNumber: m.accountNumber,
      cci: m.cci,
      walletPhone: m.walletPhone,
      walletQrUrl: m.walletQrUrl,
    };
    this.formError.set(null);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editingId.set(null);
    this.formError.set(null);
  }

  protected submit(): void {
    const id = this.editingId();
    this.formError.set(null);

    if (id) {
      const update: PaymentMethodUpdateRequest = { active: true };
      const displayName = this.form.displayName?.trim();
      if (displayName) update.displayName = displayName;

      if (this.form.methodType === 'BANK_TRANSFER') {
        const bankName = this.form.bankName?.trim();
        const accountHolder = this.form.accountHolder?.trim();
        const accountNumber = this.form.accountNumber?.trim();
        const cci = this.form.cci?.trim();
        if (bankName) update.bankName = bankName;
        if (accountHolder) update.accountHolder = accountHolder;
        if (accountNumber) update.accountNumber = accountNumber;
        if (cci) update.cci = cci;
      } else if (this.form.methodType === 'YAPE' || this.form.methodType === 'PLIN') {
        const walletPhone = this.form.walletPhone?.trim();
        const walletQrUrl = this.form.walletQrUrl?.trim();
        if (walletPhone) update.walletPhone = walletPhone;
        if (walletQrUrl) update.walletQrUrl = walletQrUrl;
      }

      this.api
        .updatePaymentMethod(id, update)
        .subscribe({
          next: () => {
            this.closeForm();
            this.load();
          },
          error: (err) =>
            this.formError.set(
              err?.error?.errors?.[0]?.message ??
                err?.error?.message ??
                'No se pudo actualizar el método.',
            ),
        });
      return;
    }

    const accountNumber = this.form.accountNumber?.trim() ?? '';
    const walletPhone = this.form.walletPhone?.trim() ?? '';

    if (this.isBank() && accountNumber.length === 0) {
      this.formError.set('Ingresa el número de cuenta.');
      return;
    }
    if (this.isWallet() && !/^9\d{8}$/.test(walletPhone)) {
      this.formError.set('El teléfono debe tener 9 dígitos y empezar con 9.');
      return;
    }

    this.saving.set(true);
    this.api
      .createPaymentMethod({
        methodType: this.form.methodType,
        displayName: this.form.displayName,
        bankName: this.form.bankName,
        accountHolder: this.form.accountHolder,
        accountNumber,
        cci: this.form.cci,
        walletPhone,
        walletQrUrl: this.form.walletQrUrl,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeForm();
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.formError.set(
            (err?.status === 409
              ? 'El método entra en conflicto con la configuración actual. Recarga la lista e inténtalo de nuevo.'
              : null) ??
              err?.error?.errors?.[0]?.message ??
              err?.error?.message ??
              'No se pudo guardar el método.',
          );
        },
      });
  }

  protected setDefault(publicUuid: string): void {
    this.api.setDefaultPaymentMethod(publicUuid).subscribe({
      next: () => this.load(),
      error: () => this.error.set('No se pudo marcar como principal.'),
    });
  }

  protected remove(m: PaymentMethodAdminResponse): void {
    const label = m.displayName || getMethodTypeLabel(m.methodType);
    if (!confirm(`¿Eliminar «${label}»?`)) return;
    this.api.deletePaymentMethod(m.publicUuid).subscribe({
      next: () => this.load(),
      error: () => this.error.set('No se pudo eliminar el método.'),
    });
  }

  protected copy(value: string | null): void {
    if (!value) return;
    void navigator.clipboard?.writeText(value);
  }

  private load(): void {
    this.loading.set(true);
    this.api.listPaymentMethods().subscribe({
      next: (list) => {
        this.methods.set(list ?? []);
        this.loading.set(false);
        this.error.set(null);
      },
      error: () => {
        this.methods.set([]);
        this.loading.set(false);
        this.error.set('No se pudieron cargar los métodos de pago.');
      },
    });
  }

  private blankForm(): AdminPaymentMethodsPageComponent['form'] {
    return {
      methodType: 'BANK_TRANSFER',
      displayName: null,
      bankName: null,
      accountHolder: null,
      accountNumber: null,
      cci: null,
      walletPhone: null,
      walletQrUrl: null,
    };
  }
}
