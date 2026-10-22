import { Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { B2BInvoiceDetail, B2BInvoiceSummary, B2BPayment } from '../models';

@Injectable({ providedIn: 'root' })
export class AdminInvoicesService {
  private readonly api = inject(ApiService);

  private readonly _invoices = signal<B2BInvoiceSummary[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _selectedInvoice = signal<B2BInvoiceDetail | null>(null);
  private readonly _totalPages = signal(0);

  readonly invoices = this._invoices.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly selectedInvoice = this._selectedInvoice.asReadonly();
  readonly totalPages = this._totalPages.asReadonly();

  loadInvoices(params: { status?: string; page?: number; size?: number } = {}): void {
    this._loading.set(true);
    this._error.set(null);
    const query: any = { page: params.page ?? 0, size: params.size ?? 10 };
    if (params.status) query.status = params.status;

    this.api.get<{ data: { content: Record<string, unknown>[]; totalPages: number } }>(API.ADMIN.INVOICES_ROOT, query).subscribe({
      next: (res) => {
        const data = res.data;
        this._invoices.set((data.content ?? []).map((row) => this.toSummary(row)));
        this._totalPages.set(data.totalPages ?? 0);
        this._loading.set(false);
      },
      error: (err) => {
        this._error.set(err?.error?.message ?? 'Error al cargar facturas');
        this._loading.set(false);
      },
    });
  }

  loadTenantInvoices(publicUuid: string): void {
    this._loading.set(true);
    this._error.set(null);
    this.api.get<{ data: Record<string, unknown>[] }>(API.ADMIN.TENANT_INVOICES(publicUuid)).subscribe({
      next: (response) => {
        this._invoices.set((response.data ?? []).map((row) => this.toSummary(row)));
        this._totalPages.set(1);
        this._loading.set(false);
      },
      error: (err) => {
        this._error.set(err?.error?.message ?? 'No se pudieron cargar los comprobantes.');
        this._loading.set(false);
      },
    });
  }

  loadInvoiceDetail(uuid: string): void {
    this._loading.set(true);
    this._error.set(null);
    forkJoin({
      invoice: this.api.get<{ data: Record<string, unknown> }>(API.ADMIN.INVOICE_BY_ID(uuid)),
      payments: this.api.get<{ data: Record<string, unknown>[] }>(API.ADMIN.INVOICE_PAYMENTS(uuid)),
    }).subscribe({
      next: ({ invoice, payments }) => {
        const row = invoice.data;
        this._selectedInvoice.set({
          ...this.toSummary(row),
          pricePerStudentCents: this.number(row['pricePerStudentCents']),
          issuedAt: String(row['issuedAt'] ?? ''),
          payments: (payments.data ?? []).map((payment) => this.toPayment(payment)),
        });
        this._loading.set(false);
      },
      error: (err) => {
        this._error.set(err?.error?.message ?? 'Error al cargar detalle');
        this._loading.set(false);
      },
    });
  }

  registerPayment(request: { invoiceId: string; amountCents: number; method: string; externalRef?: string; notes?: string }, invoiceUuid: string): void {
    this.api.post(API.ADMIN.B2B_PAYMENTS, request).subscribe({
      next: () => { this.loadInvoices(); this.loadInvoiceDetail(invoiceUuid); },
      error: (err) => this._error.set(err?.error?.message ?? 'No se pudo registrar el pago.'),
    });
  }

  private toSummary(row: Record<string, unknown>): B2BInvoiceSummary {
    const start = String(row['periodStart'] ?? '');
    const end = String(row['periodEnd'] ?? '');
    return {
      publicUuid: String(row['id'] ?? row['publicUuid'] ?? ''),
      tenantName: String(row['tenantName'] ?? row['tenantId'] ?? 'Institución'),
      period: start && end ? `${start} – ${end}` : String(row['period'] ?? start),
      activeStudents: this.number(row['activeStudentCount'] ?? row['activeStudents']),
      totalCents: this.number(row['totalCents']),
      status: String(row['status'] ?? ''),
      dueDate: String(row['dueAt'] ?? row['dueDate'] ?? ''),
      paidAt: row['paidAt'] ? String(row['paidAt']) : undefined,
    };
  }

  private toPayment(row: Record<string, unknown>): B2BPayment {
    return {
      publicUuid: String(row['id'] ?? row['publicUuid'] ?? ''),
      amountCents: this.number(row['amountCents']),
      method: String(row['paymentMethod'] ?? row['method'] ?? ''),
      reference: String(row['externalRef'] ?? row['reference'] ?? ''),
      status: String(row['status'] ?? ''),
      paidAt: String(row['paidAt'] ?? ''),
    };
  }

  private number(value: unknown): number {
    return typeof value === 'number' ? value : Number(value ?? 0) || 0;
  }
}
