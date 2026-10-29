import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Permission } from '@core/enums';
import { AuthService } from '@core/services';
import { mapHttpError } from '@shared/utils';
import { FilePreviewDialogComponent } from '@shared/components';
import { FileUploadComponent, ModuleUploadResponse } from '@shared/components/file-upload/file-upload.component';
import { FileMetadata } from '@core/services/file-upload.service';
import { PaymentsApiService } from '../../services/payments-api.service';
import {
  AdminInvoiceListItem,
  Invoice,
  STATUS_BADGE,
  STATUS_LABELS,
  formatMoney,
} from '../../models/invoice.model';

/**
 * Admin invoice review queue — vouchers submitted by parents.
 */
@Component({
  selector: 'app-admin-invoices-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, FormsModule, FilePreviewDialogComponent, FileUploadComponent],
  template: `
    <section>
      @if (canReadPayments()) {
      <label class="mb-4 block max-w-xs text-sm">
        <span class="font-medium text-slate-700 dark:text-slate-300">Estado</span>
        <select
          class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          [ngModel]="statusFilter()"
          (ngModelChange)="onStatusChange($event)"
        >
          <option value="PENDING_REVIEW">En revisión</option>
          <option value="PENDING">Pendiente</option>
          <option value="OVERDUE">Vencida</option>
          <option value="PAID">Pagada</option>
          <option value="">Todas</option>
        </select>
      </label>
      }
      <p class="-mt-2 mb-4 text-xs text-slate-500">
        @if (reconciliationOnly()) {
          Solo se muestran cuotas con voucher en revisión. Para consultar otros pagos, solicita el permiso Consultar pagos.
        } @else {
          Para registrar efectivo, filtra por Pendiente o Vencida. Las cuotas con voucher en revisión
          se aprueban o rechazan desde esta misma pantalla.
        }
      </p>

      @if (banner(); as b) {
        <div
          class="mb-4 rounded-md px-4 py-3 text-sm"
          [class]="b.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'"
        >
          {{ b.message }}
          <button type="button" class="ml-2 underline" (click)="banner.set(null)">Cerrar</button>
        </div>
      }

      @if (loading()) {
        <div class="space-y-3">
          @for (i of [1, 2, 3]; track i) {
            <div class="h-16 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"></div>
          }
        </div>
      } @else if (errorMsg()) {
        <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          <p class="font-semibold">Acceso restringido</p>
          <p class="mt-1">{{ errorMsg() }}</p>
          @if (!accessDenied()) {
            <button type="button" class="mt-2 underline" (click)="load()">Reintentar</button>
          }
        </div>
      } @else if (items().length === 0) {
        <div
          class="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-700"
        >
          <p class="text-sm font-medium text-slate-700 dark:text-slate-300">
            {{ reconciliationOnly() ? 'No hay vouchers pendientes de revisar' : 'Sin cuotas' }}
          </p>
          <p class="mt-1 text-xs text-slate-500">
            {{ reconciliationOnly() ? 'Los nuevos vouchers aparecerán aquí.' : 'Ajusta el filtro o espera vouchers de padres.' }}
          </p>
        </div>
      } @else {
        <div class="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-left dark:bg-slate-800/50">
              <tr>
                <th class="px-4 py-2">Estudiante</th>
                <th class="px-4 py-2">Periodo</th>
                <th class="px-4 py-2">Estado</th>
                <th class="px-4 py-2 text-right">Monto</th>
                <th class="px-4 py-2">Voucher</th>
                <th class="px-4 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
              @for (inv of items(); track inv.publicUuid) {
                <tr>
                  <td class="px-4 py-3">
                    <div class="font-medium text-slate-900 dark:text-slate-100">
                      {{ inv.studentIdentity?.fullName || 'Estudiante' }}
                    </div>
                    @if (inv.studentIdentity; as student) {
                      <div class="text-xs text-slate-500">
                        {{ student.documentType }} {{ student.documentNumber }}
                      </div>
                    }
                  </td>
                  <td class="px-4 py-3">
                    <div class="font-semibold text-slate-900 dark:text-slate-100">
                      {{ inv.periodLabel }}
                    </div>
                    <div class="text-xs text-slate-500">
                      Vence {{ inv.dueAt | date: 'shortDate' }}
                      @if (inv.evidenceNotes) {
                        · {{ inv.evidenceNotes }}
                      }
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {{
                        badgeClass(inv.status)
                      }}"
                    >
                      {{ statusLabel(inv.status) }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right font-medium">
                    {{ money(amountForDisplay(inv), inv.currency) }}
                  </td>
                  <td class="px-4 py-3">
                    @if (inv.evidenceFilePublicUuid) {
                      <button
                        type="button"
                        class="text-sm font-semibold text-indigo-600 underline"
                        (click)="viewVoucher(inv)"
                      >
                        Ver voucher
                      </button>
                    } @else {
                      <span class="text-xs text-slate-400">—</span>
                    }
                  </td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex flex-wrap justify-end gap-2">
                    @if (canReceive() && inv.status === 'PENDING_REVIEW') {
                      <button
                        type="button"
                        class="mr-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        [disabled]="busyUuid() === inv.publicUuid"
                        (click)="approve(inv)"
                      >
                        Aprobar voucher
                      </button>
                    }
                    @if (canReceive() && (inv.status === 'PENDING' || inv.status === 'OVERDUE')) {
                      <button
                        type="button"
                        class="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        [disabled]="busyUuid() === inv.publicUuid"
                        (click)="openCashModal(inv)"
                      >
                        Registrar efectivo
                      </button>
                    }
                    @if (canReceive() && (inv.status === 'PENDING' || inv.status === 'OVERDUE' || inv.status === 'PENDING_REVIEW')) {
                      <button type="button" class="rounded-md border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:border-indigo-800 dark:text-indigo-300"
                        [disabled]="busyUuid() === inv.publicUuid" (click)="openEvidenceModal(inv)">
                        Adjuntar comprobante
                      </button>
                    }
                    @if (canReconcile() && inv.status === 'PENDING_REVIEW') {
                      <button
                        type="button"
                        class="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50"
                        [disabled]="busyUuid() === inv.publicUuid"
                        (click)="reject(inv)"
                      >
                        Rechazar
                      </button>
                    }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    @if (cashInvoice(); as inv) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        role="presentation"
        (click)="closeCashModal()"
      >
        <section
          class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cash-payment-title"
          (click)="$event.stopPropagation()"
        >
          <h2 id="cash-payment-title" class="text-lg font-bold text-slate-900 dark:text-slate-100">
            Confirmar pago en efectivo
          </h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Confirma que recibiste el monto completo antes de marcar la cuota como pagada.
          </p>
          <dl class="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800">
            <div class="flex justify-between gap-4">
              <dt class="text-slate-500">Estudiante</dt>
              <dd class="text-right font-medium text-slate-900 dark:text-slate-100">
                {{ inv.studentIdentity?.fullName || inv.studentId }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-slate-500">Documento</dt>
              <dd class="text-right font-medium text-slate-900 dark:text-slate-100">
                {{ inv.studentIdentity ? inv.studentIdentity.documentType + ' ' + inv.studentIdentity.documentNumber : '—' }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-slate-500">Periodo</dt>
              <dd class="text-right font-medium text-slate-900 dark:text-slate-100">
                {{ inv.periodLabel }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-slate-500">Monto recibido</dt>
              <dd class="text-right font-bold text-slate-900 dark:text-slate-100">
                {{ money(amountForDisplay(inv), inv.currency) }}
              </dd>
            </div>
          </dl>
          <label class="mt-4 block text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-300">N.° de recibo u observación (opcional)</span>
            <textarea
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              rows="2"
              maxlength="300"
              [ngModel]="cashNote()"
              [ngModelOptions]="{ standalone: true }"
              (ngModelChange)="cashNote.set($event)"
              placeholder="Ej.: Recibo 00428"
            ></textarea>
          </label>
          <div class="mt-5 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
              [disabled]="busyUuid() === inv.publicUuid"
              (click)="closeCashModal()"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              [disabled]="busyUuid() === inv.publicUuid"
              (click)="registerCashPayment()"
            >
              {{ busyUuid() === inv.publicUuid ? 'Registrando…' : 'Confirmar pago' }}
            </button>
          </div>
        </section>
      </div>
    }

    @if (evidenceInvoice(); as inv) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" (click)="closeEvidenceModal()">
        <section class="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="front-desk-evidence-title" (click)="$event.stopPropagation()">
          <div>
            <h2 id="front-desk-evidence-title" class="text-lg font-bold text-slate-900 dark:text-slate-100">Adjuntar comprobante recibido en ventanilla</h2>
            <p class="mt-1 text-sm text-slate-500">{{ inv.studentIdentity?.fullName || 'Estudiante' }} · {{ inv.periodLabel }} · saldo {{ money(amountForDisplay(inv), inv.currency) }}</p>
          </div>
          <label class="block text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-300">Referencia o nota (opcional)</span>
            <input type="text" maxlength="500" [ngModel]="evidenceNote()" [ngModelOptions]="{ standalone: true }" (ngModelChange)="evidenceNote.set($event)"
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <app-file-upload module="payments" accept="image/*,application/pdf" [maxSizeMb]="10"
            (uploaded)="onStaffEvidenceUploaded($event)" (uploadError)="banner.set({ ok: false, message: $event })" />
          <p class="text-xs text-slate-500">El cargo quedará en revisión. Un usuario autorizado debe aprobar o rechazar el comprobante antes de marcarlo pagado.</p>
          <div class="flex justify-end">
            <button type="button" (click)="closeEvidenceModal()" [disabled]="busyUuid() === inv.publicUuid" class="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Cerrar</button>
          </div>
        </section>
      </div>
    }

    @if (previewingVoucher(); as voucher) {
      <app-file-preview-dialog
        [open]="true"
        [filePublicUuid]="voucher.filePublicUuid"
        [filename]="voucher.filename"
        (closed)="previewingVoucher.set(null)"
      />
    }
  `,
})
export class AdminInvoicesPageComponent implements OnInit {
  private readonly api = inject(PaymentsApiService);
  private readonly auth = inject(AuthService);

  readonly items = signal<AdminInvoiceListItem[]>([]);
  readonly loading = signal(true);
  readonly errorMsg = signal<string | null>(null);
  readonly accessDenied = signal(false);
  readonly statusFilter = signal('PENDING_REVIEW');
  readonly busyUuid = signal<string | null>(null);
  readonly banner = signal<{ ok: boolean; message: string } | null>(null);
  readonly cashInvoice = signal<AdminInvoiceListItem | null>(null);
  readonly cashNote = signal('');
  readonly previewingVoucher = signal<{ filePublicUuid: string; filename: string } | null>(null);
  readonly evidenceInvoice = signal<AdminInvoiceListItem | null>(null);
  readonly evidenceNote = signal('');

  canReceive(): boolean {
    return this.auth.hasPermission(Permission.PaymentsReceive, Permission.LmsPaymentAdmin);
  }

  canReconcile(): boolean {
    return this.auth.hasPermission(Permission.PaymentsReconcile, Permission.LmsPaymentAdmin);
  }

  canReadPayments(): boolean {
    return this.auth.hasPermission(Permission.PaymentsReadGranular, Permission.LmsPaymentAdmin);
  }

  reconciliationOnly(): boolean {
    return !this.canReadPayments() && this.canReconcile();
  }

  ngOnInit(): void {
    this.load();
  }

  onStatusChange(value: string): void {
    this.statusFilter.set(value);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.accessDenied.set(false);
    const status = this.statusFilter();
    const request = this.canReadPayments()
      ? this.api.listAdminInvoices({
          status: status ? (status as Invoice['status']) : undefined,
          page: 0,
          size: 50,
        })
      : this.api.listInvoiceReviewQueue({ page: 0, size: 50 });
    request
      .subscribe({
        next: (page) => {
          this.items.set(page.content ?? []);
          this.loading.set(false);
        },
        error: (e) => {
          this.accessDenied.set(e instanceof HttpErrorResponse && e.status === 403);
          this.errorMsg.set(
            mapHttpError(e as HttpErrorResponse, {
              fallback:
                this.reconciliationOnly()
                  ? 'No tienes permiso para revisar vouchers. Solicita este acceso al director o al administrador del colegio.'
                  : 'No tienes permiso para consultar pagos. Solicita este acceso al director o al administrador del colegio.',
            }),
          );
          this.loading.set(false);
        },
      });
  }

  viewVoucher(invoice: AdminInvoiceListItem): void {
    if (!invoice.evidenceFilePublicUuid) return;
    this.previewingVoucher.set({
      filePublicUuid: invoice.evidenceFilePublicUuid,
      filename: `voucher-${invoice.publicUuid}`,
    });
  }

  openEvidenceModal(invoice: AdminInvoiceListItem): void {
    this.evidenceNote.set('');
    this.evidenceInvoice.set(invoice);
  }

  closeEvidenceModal(): void {
    const invoice = this.evidenceInvoice();
    if (invoice && this.busyUuid() === invoice.publicUuid) return;
    this.evidenceInvoice.set(null);
    this.evidenceNote.set('');
  }

  onStaffEvidenceUploaded(file: FileMetadata | ModuleUploadResponse): void {
    const invoice = this.evidenceInvoice();
    if (!invoice || this.busyUuid() === invoice.publicUuid) return;
    this.busyUuid.set(invoice.publicUuid);
    this.api.submitEvidenceByStaff(invoice.publicUuid, {
      filePublicUuid: file.publicUuid,
      notes: this.evidenceNote().trim() || undefined,
    }).subscribe({
      next: () => {
        this.busyUuid.set(null);
        this.evidenceInvoice.set(null);
        this.evidenceNote.set('');
        this.banner.set({ ok: true, message: `Comprobante adjuntado para ${invoice.periodLabel}; queda pendiente de aprobación.` });
        this.load();
      },
      error: (error) => {
        this.busyUuid.set(null);
        this.banner.set({ ok: false, message: error?.error?.message ?? 'No se pudo adjuntar el comprobante.' });
      },
    });
  }

  openCashModal(invoice: AdminInvoiceListItem): void {
    this.cashNote.set('');
    this.cashInvoice.set(invoice);
  }

  closeCashModal(): void {
    const invoice = this.cashInvoice();
    if (invoice && this.busyUuid() === invoice.publicUuid) return;
    this.cashInvoice.set(null);
    this.cashNote.set('');
  }

  registerCashPayment(): void {
    const invoice = this.cashInvoice();
    if (!invoice || this.busyUuid() === invoice.publicUuid) return;

    this.busyUuid.set(invoice.publicUuid);
    const note = this.cashNote().trim();
    this.api.markInvoicePaidCash(invoice.publicUuid, { note: note || undefined }).subscribe({
      next: () => {
        this.busyUuid.set(null);
        this.cashInvoice.set(null);
        this.cashNote.set('');
        this.banner.set({
          ok: true,
          message: `Pago en efectivo registrado. La cuota ${invoice.periodLabel} quedó pagada.`,
        });
        this.load();
      },
      error: (e) => {
        this.busyUuid.set(null);
        this.cashInvoice.set(null);
        this.cashNote.set('');
        this.banner.set({
          ok: false,
          message: e?.error?.message ?? 'No se pudo registrar el pago en efectivo',
        });
        this.load();
      },
    });
  }

  approve(inv: AdminInvoiceListItem): void {
    this.busyUuid.set(inv.publicUuid);
    this.api.approveEvidence(inv.publicUuid).subscribe({
      next: () => {
        this.busyUuid.set(null);
        this.banner.set({ ok: true, message: `Voucher aprobado. Cuota ${inv.periodLabel} pagada.` });
        this.load();
      },
      error: (e) => {
        this.busyUuid.set(null);
        this.banner.set({
          ok: false,
          message: e?.error?.message ?? 'No se pudo aprobar la cuota',
        });
      },
    });
  }

  reject(inv: AdminInvoiceListItem): void {
    const reason = window.prompt('Motivo del rechazo (mín. 4 caracteres):', '');
    if (reason == null) return;
    if (reason.trim().length < 4) {
      this.banner.set({ ok: false, message: 'El motivo debe tener al menos 4 caracteres.' });
      return;
    }
    this.busyUuid.set(inv.publicUuid);
    this.api.rejectEvidence(inv.publicUuid, { reason: reason.trim() }).subscribe({
      next: () => {
        this.busyUuid.set(null);
        this.banner.set({ ok: true, message: `Voucher de ${inv.periodLabel} rechazado.` });
        this.load();
      },
      error: (e) => {
        this.busyUuid.set(null);
        this.banner.set({
          ok: false,
          message: e?.error?.message ?? 'No se pudo rechazar el voucher',
        });
      },
    });
  }

  statusLabel(s: Invoice['status']) {
    return STATUS_LABELS[s];
  }
  badgeClass(s: Invoice['status']) {
    return STATUS_BADGE[s];
  }
  money(cents: number, c: string) {
    return formatMoney(cents, c);
  }
  amountForDisplay(invoice: AdminInvoiceListItem): number {
    return invoice.status === 'PAID'
      ? invoice.totalCents
      : ('balanceCents' in invoice ? (invoice.balanceCents ?? invoice.totalCents) : invoice.totalCents);
  }
}
