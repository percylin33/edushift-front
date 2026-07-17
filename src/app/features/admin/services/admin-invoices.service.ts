import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { B2BInvoiceDetail, B2BInvoiceSummary, MarkPaidRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class AdminInvoicesService {
  private readonly api = inject(ApiService);

  private readonly _invoices = signal<B2BInvoiceSummary[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _selectedInvoice = signal<B2BInvoiceDetail | null>(null);

  readonly invoices = this._invoices.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly selectedInvoice = this._selectedInvoice.asReadonly();

  loadInvoices(params: { status?: string; page?: number; size?: number } = {}): void {
    this._loading.set(true);
    this._error.set(null);
    const query: any = { page: params.page ?? 0, size: params.size ?? 10 };
    if (params.status) query.status = params.status;

    this.api.get<any>(API.ADMIN.INVOICES_ROOT, query).subscribe({
      next: (res) => {
        const data = res.data ?? res;
        this._invoices.set(data.content ?? data);
        this._loading.set(false);
      },
      error: (err) => {
        this._error.set(err?.error?.message ?? 'Error al cargar facturas');
        this._loading.set(false);
      },
    });
  }

  loadInvoiceDetail(uuid: string): void {
    this._loading.set(true);
    this._error.set(null);
    this.api.get<any>(API.ADMIN.INVOICE_PAYMENTS(uuid)).subscribe({
      next: (res) => {
        this._selectedInvoice.set(res.data ?? res);
        this._loading.set(false);
      },
      error: (err) => {
        this._error.set(err?.error?.message ?? 'Error al cargar detalle');
        this._loading.set(false);
      },
    });
  }

  markAsPaid(uuid: string, request: MarkPaidRequest): void {
    this.api.post<void>(API.ADMIN.INVOICE_MARK_PAID(uuid), request).subscribe({
      next: () => this.loadInvoiceDetail(uuid),
      error: (err) => this._error.set(err?.error?.message ?? 'Error al marcar pagada'),
    });
  }
}
