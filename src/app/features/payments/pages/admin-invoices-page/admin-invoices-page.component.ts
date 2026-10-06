import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FileUploadService } from '@core/services/file-upload.service';
import { PaymentsApiService } from '../../services/payments-api.service';
import {
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
  imports: [CommonModule, DatePipe, FormsModule, RouterLink],
  template: `
    <section class="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <header class="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
            Conciliación de cuotas
          </h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Revisa vouchers enviados por apoderados y aprueba o rechaza el pago.
          </p>
        </div>
        <a routerLink="/payments/admin/payments" class="text-sm font-semibold text-indigo-600">
          Ver registro de pagos
        </a>
      </header>

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
        <p class="text-sm text-rose-600">{{ errorMsg() }}</p>
        <button type="button" class="mt-2 text-sm underline" (click)="load()">Reintentar</button>
      } @else if (items().length === 0) {
        <div
          class="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-700"
        >
          <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Sin cuotas</p>
          <p class="mt-1 text-xs text-slate-500">Ajusta el filtro o espera vouchers de padres.</p>
        </div>
      } @else {
        <div class="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-left dark:bg-slate-800/50">
              <tr>
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
                    {{ money(inv.totalCents, inv.currency) }}
                  </td>
                  <td class="px-4 py-3">
                    @if (inv.evidenceFilePublicUuid) {
                      <button
                        type="button"
                        class="text-sm font-semibold text-indigo-600 underline"
                        (click)="viewVoucher(inv.evidenceFilePublicUuid!)"
                      >
                        Ver voucher
                      </button>
                    } @else {
                      <span class="text-xs text-slate-400">—</span>
                    }
                  </td>
                  <td class="px-4 py-3 text-right">
                    @if (inv.status === 'PENDING_REVIEW' || inv.status === 'PENDING' || inv.status === 'OVERDUE') {
                      <button
                        type="button"
                        class="mr-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        [disabled]="busyUuid() === inv.publicUuid"
                        (click)="approve(inv)"
                      >
                        Aprobar
                      </button>
                    }
                    @if (inv.status === 'PENDING_REVIEW') {
                      <button
                        type="button"
                        class="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50"
                        [disabled]="busyUuid() === inv.publicUuid"
                        (click)="reject(inv)"
                      >
                        Rechazar
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class AdminInvoicesPageComponent implements OnInit {
  private readonly api = inject(PaymentsApiService);
  private readonly files = inject(FileUploadService);

  readonly items = signal<Invoice[]>([]);
  readonly loading = signal(true);
  readonly errorMsg = signal<string | null>(null);
  readonly statusFilter = signal('PENDING_REVIEW');
  readonly busyUuid = signal<string | null>(null);
  readonly banner = signal<{ ok: boolean; message: string } | null>(null);

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
    const status = this.statusFilter();
    this.api
      .listAdminInvoices({
        status: status ? (status as Invoice['status']) : undefined,
        page: 0,
        size: 50,
      })
      .subscribe({
        next: (page) => {
          this.items.set(page.content ?? []);
          this.loading.set(false);
        },
        error: (e) => {
          this.errorMsg.set(e?.error?.message ?? 'No se pudieron cargar las cuotas');
          this.loading.set(false);
        },
      });
  }

  viewVoucher(filePublicUuid: string): void {
    this.files.downloadAndSave(filePublicUuid, `voucher-${filePublicUuid}`).catch(() => {
      this.banner.set({ ok: false, message: 'No se pudo abrir el voucher' });
    });
  }

  approve(inv: Invoice): void {
    this.busyUuid.set(inv.publicUuid);
    this.api.markInvoicePaidCash(inv.publicUuid, { note: 'Aprobado con voucher' }).subscribe({
      next: () => {
        this.busyUuid.set(null);
        this.banner.set({ ok: true, message: `Cuota ${inv.periodLabel} marcada como pagada.` });
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

  reject(inv: Invoice): void {
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
}
