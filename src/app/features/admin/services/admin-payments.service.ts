import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { B2BPaymentSummary, RefundPaymentRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class AdminPaymentsService {
  private readonly api = inject(ApiService);

  private readonly _payments = signal<B2BPaymentSummary[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly payments = this._payments.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  loadPayments(params: { page?: number; size?: number } = {}): void {
    this._loading.set(true);
    this._error.set(null);
    this.api.get<any>(API.ADMIN.PAYMENTS_ROOT, { page: params.page ?? 0, size: params.size ?? 10 }).subscribe({
      next: (res) => {
        const data = res.data ?? res;
        this._payments.set(data.content ?? data);
        this._loading.set(false);
      },
      error: (err) => {
        this._error.set(err?.error?.message ?? 'Error al cargar pagos');
        this._loading.set(false);
      },
    });
  }

  refundPayment(uuid: string, request: RefundPaymentRequest): void {
    this.api.post<void>(API.ADMIN.PAYMENTS_REFUND(uuid), request).subscribe({
      next: () => this.loadPayments(),
      error: (err) => this._error.set(err?.error?.message ?? 'Error al reembolsar'),
    });
  }
}
