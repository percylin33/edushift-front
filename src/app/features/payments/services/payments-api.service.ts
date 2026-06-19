import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services';
import { API } from '@core/constants/api.constants';
import { CheckoutResponse, Invoice, Payment } from '../models/invoice.model';

/**
 * Payments REST service (Sprint 10 / FE-10.1).
 *
 * <p>User-facing: lists the guardian's invoices, fetches detail,
 * starts a Checkout Pro flow. Admin reconciliation is out of MVP
 * scope (DEBT-10-ADMIN-1).</p>
 */
@Injectable({ providedIn: 'root' })
export class PaymentsApiService {
  private readonly api = inject(ApiService);

  listMyInvoices(page = 0, size = 20): Observable<{ content: Invoice[]; totalElements: number }> {
    return this.api.get<{ content: Invoice[]; totalElements: number }>(
      `${API.PAYMENTS.INVOICES}?page=${page}&size=${size}`
    );
  }

  getInvoice(publicUuid: string): Observable<Invoice> {
    return this.api.get<Invoice>(API.PAYMENTS.INVOICE_BY_ID(publicUuid));
  }

  listPaymentsForInvoice(publicUuid: string): Observable<Payment[]> {
    return this.api.get<Payment[]>(API.PAYMENTS.INVOICE_PAYMENTS(publicUuid));
  }

  /**
   * Start a Checkout Pro flow. Returns the URL the FE should
   * open in a new tab.
   */
  checkout(publicUuid: string): Observable<CheckoutResponse> {
    return this.api.post<CheckoutResponse>(API.PAYMENTS.INVOICE_CHECKOUT(publicUuid), {});
  }
}
