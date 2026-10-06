import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FileMetadata, FileUploadService } from '@core/services/file-upload.service';
import {
  FileUploadComponent,
  ModuleUploadResponse,
} from '@shared/components/file-upload/file-upload.component';
import { PaymentsApiService } from '../../services/payments-api.service';
import {
  Invoice,
  InvoiceItem,
  Payment,
  STATUS_BADGE,
  STATUS_LABELS,
  formatMoney,
} from '../../models/invoice.model';

/**
 * Invoice detail with voucher upload (manual reconciliation).
 * MercadoPago checkout is intentionally not exposed in the parent UI.
 */
@Component({
  selector: 'app-invoice-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, FormsModule, FileUploadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <a routerLink="/payments/invoices" class="text-sm text-slate-500 hover:text-slate-700"
        >← Mis cuotas</a
      >

      @if (invoice(); as i) {
        <article
          class="mt-4 rounded-2xl bg-white p-6 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <header class="flex items-start justify-between gap-4">
            <div>
              <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Cuota {{ i.periodLabel || '—' }}
              </h1>
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Vence {{ i.dueAt ? (i.dueAt | date: 'longDate') : '—' }}
              </p>
            </div>
            <span
              class="inline-flex items-center rounded-full px-3 py-1 text-xs
                         font-medium {{ badgeClass(i.status) }}"
            >
              {{ statusLabel(i.status) }}
            </span>
          </header>

          <table class="mt-6 w-full text-sm">
            <thead class="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th class="pb-2">Descripción</th>
                <th class="pb-2 text-right">Cant.</th>
                <th class="pb-2 text-right">Unitario</th>
                <th class="pb-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              @for (it of i.items ?? []; track it.id) {
                <tr>
                  <td class="py-2 text-slate-800 dark:text-slate-200">{{ it.description }}</td>
                  <td class="py-2 text-right text-slate-600 dark:text-slate-300">
                    {{ it.quantity }}
                  </td>
                  <td class="py-2 text-right text-slate-600 dark:text-slate-300">
                    {{ money(it.unitAmountCents, i.currency) }}
                  </td>
                  <td class="py-2 text-right font-semibold text-slate-800 dark:text-slate-100">
                    {{ money(it.lineTotalCents, i.currency) }}
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="py-4 text-center text-sm text-slate-500">
                    Sin detalle de ítems
                  </td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" class="pt-4 text-right text-slate-500 dark:text-slate-400">
                  Total
                </td>
                <td class="pt-4 text-right text-xl font-bold text-slate-900 dark:text-slate-100">
                  {{ money(i.totalCents, i.currency) }}
                </td>
              </tr>
            </tfoot>
          </table>

          @if (i.evidenceRejectionReason) {
            <p class="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
              Voucher rechazado: {{ i.evidenceRejectionReason }}
            </p>
          }

          @if (canUploadEvidence()) {
            <div class="mt-6 space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800">
              <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">
                {{ i.status === 'PENDING_REVIEW' ? 'Reemplazar voucher' : 'Subir voucher' }}
              </h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                Paga fuera de la app (efectivo, transferencia, Yape, etc.) y adjunta la imagen o PDF
                del comprobante. El colegio lo revisará antes de marcar la cuota como pagada.
              </p>
              <label class="block text-sm">
                <span class="font-medium text-slate-700 dark:text-slate-300">Nota (opcional)</span>
                <input
                  type="text"
                  class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  [(ngModel)]="evidenceNotes"
                  placeholder="Nro. de operación / banco"
                  maxlength="500"
                />
              </label>
              <app-file-upload
                module="payments"
                accept="image/*,application/pdf"
                [maxSizeMb]="10"
                (uploaded)="onEvidenceUploaded($event)"
                (uploadError)="errorMsg.set($event)"
              />
              @if (submittingEvidence()) {
                <p class="text-sm text-slate-500">Enviando voucher…</p>
              }
            </div>
          }

          @if (i.status === 'PENDING_REVIEW' && i.evidenceFilePublicUuid) {
            <div class="mt-6 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:bg-sky-900/20 dark:text-sky-200">
              Voucher en revisión
              @if (i.evidenceSubmittedAt) {
                · enviado {{ i.evidenceSubmittedAt | date: 'short' }}
              }
              <button
                type="button"
                class="ml-2 font-semibold underline"
                (click)="onViewEvidence(i.evidenceFilePublicUuid!)"
              >
                Ver archivo
              </button>
            </div>
          }

          @if (canDownloadReceipt()) {
            <div class="mt-6 flex justify-end">
              <button
                type="button"
                (click)="onDownloadReceipt()"
                class="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100"
              >
                Descargar comprobante
              </button>
            </div>
          }

          @if (errorMsg()) {
            <p class="mt-3 text-sm text-rose-600">{{ errorMsg() }}</p>
          }
        </article>

        @if (payments().length > 0) {
          <section
            class="mt-6 rounded-2xl bg-white p-6 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
          >
            <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">
              Intentos de pago
            </h2>
            <ul class="mt-3 space-y-2 text-sm">
              @for (p of payments(); track p.publicUuid) {
                <li
                  class="flex items-center justify-between border-b border-slate-100 pb-2 last:border-b-0 dark:border-slate-800"
                >
                  <div>
                    <span class="font-medium text-slate-800 dark:text-slate-200">
                      {{ p.provider }} · {{ p.status }}
                    </span>
                    @if (p.failureReason) {
                      <p class="text-xs text-rose-600">{{ p.failureReason }}</p>
                    }
                  </div>
                  <div class="text-right text-slate-700 dark:text-slate-200">
                    <div>{{ money(p.amountCents, p.currency) }}</div>
                    <div class="text-xs text-slate-500">
                      {{ p.createdAt | date: 'short' }}
                    </div>
                  </div>
                </li>
              }
            </ul>
          </section>
        }
      } @else if (loading()) {
        <div
          class="mt-4 animate-pulse rounded-2xl bg-white p-6 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <div class="mb-4 h-5 w-1/3 rounded bg-slate-200 dark:bg-slate-700"></div>
          <div class="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700"></div>
        </div>
      } @else {
        <p class="mt-4 text-sm text-rose-600">{{ errorMsg() ?? 'Cuota no encontrada' }}</p>
      }
    </section>
  `,
})
export class InvoiceDetailPageComponent implements OnInit {
  private readonly api = inject(PaymentsApiService);
  private readonly files = inject(FileUploadService);
  private readonly route = inject(ActivatedRoute);

  readonly invoice = signal<Invoice | null>(null);
  readonly items = signal<InvoiceItem[]>([]);
  readonly payments = signal<Payment[]>([]);
  readonly loading = signal(true);
  readonly submittingEvidence = signal(false);
  readonly errorMsg = signal<string | null>(null);
  evidenceNotes = '';

  ngOnInit(): void {
    const publicUuid = this.route.snapshot.paramMap.get('publicUuid');
    if (!publicUuid) {
      this.errorMsg.set('UUID inválido');
      this.loading.set(false);
      return;
    }
    this.reload(publicUuid);
  }

  canUploadEvidence(): boolean {
    const i = this.invoice();
    return !!i && (i.status === 'PENDING' || i.status === 'OVERDUE' || i.status === 'PENDING_REVIEW');
  }

  canDownloadReceipt(): boolean {
    return this.invoice()?.status === 'PAID';
  }

  onEvidenceUploaded(meta: FileMetadata | ModuleUploadResponse): void {
    const i = this.invoice();
    if (!i) return;
    this.submittingEvidence.set(true);
    this.errorMsg.set(null);
    this.api
      .submitEvidence(i.publicUuid, {
        filePublicUuid: meta.publicUuid,
        notes: this.evidenceNotes?.trim() || undefined,
      })
      .subscribe({
        next: (updated) => {
          this.invoice.set(updated);
          this.items.set(updated.items ?? []);
          this.submittingEvidence.set(false);
        },
        error: (e) => {
          this.submittingEvidence.set(false);
          this.errorMsg.set(e?.error?.message ?? 'No se pudo enviar el voucher');
        },
      });
  }

  onViewEvidence(filePublicUuid: string): void {
    this.files.downloadAndSave(filePublicUuid, `voucher-${filePublicUuid}`).catch(() => {
      this.errorMsg.set('No se pudo abrir el voucher');
    });
  }

  onDownloadReceipt(): void {
    const i = this.invoice();
    if (!i) return;
    this.api.downloadReceipt(i.publicUuid).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `comprobante-${i.publicUuid}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.errorMsg.set('No se pudo descargar el comprobante'),
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

  private reload(publicUuid: string): void {
    this.loading.set(true);
    this.api.getInvoice(publicUuid).subscribe({
      next: (i) => {
        this.invoice.set(i);
        this.items.set(i.items ?? []);
        this.evidenceNotes = i.evidenceNotes ?? '';
        this.loading.set(false);
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.message ?? 'No se pudo cargar la cuota');
        this.loading.set(false);
      },
    });
    this.api.listPaymentsForInvoice(publicUuid).subscribe({
      next: (ps) => this.payments.set(ps),
      error: () => {
        /* non-blocking */
      },
    });
  }
}
