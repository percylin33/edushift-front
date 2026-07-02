import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services';
import { API } from '@core/constants/api.constants';
import {
  AdminPaymentsQuery,
  CheckoutResponse,
  Invoice,
  MarkInvoicePaidCashRequest,
  Payment,
  ReconcilePaymentRequest,
  RefundPaymentRequest,
} from '../models/invoice.model';

/**
 * Payments REST service (Sprint 10 / FE-10.1 + Sprint 11 / FE-11.1).
 *
 * <p>User-facing methods: {@code listMyInvoices}, {@code getInvoice},
 * {@code listPaymentsForInvoice}, {@code checkout} — listed first
 * because they are the public surface a guardian uses.</p>
 *
 * <p>Admin methods ({@code listAllPayments}, {@code reconcile},
 * {@code refund}, {@code markInvoicePaidCash}) are guarded by
 * {@code LMS_PAYMENT_ADMIN} on the backend; the FE mirrors that
 * intent with the {@code hasAuthority('LMS_PAYMENT_ADMIN')} guard
 * on the route.</p>
 */
@Injectable({ providedIn: 'root' })
export class PaymentsApiService {
  private readonly api = inject(ApiService);

  // -------------------------------------------------------------------------
  // User-facing (Sprint 10 / FE-10.1)
  // -------------------------------------------------------------------------

  listMyInvoices(page = 0, size = 20): Observable<{ content: Invoice[]; totalElements: number }> {
    return this.api.get<{ content: Invoice[]; totalElements: number }>(
      `${API.PAYMENTS.INVOICES}?page=${page}&size=${size}`,
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

  // -------------------------------------------------------------------------
  // Admin (Sprint 11 / FE-11.1, BE-11.7). All guarded server-side by
  // `LMS_PAYMENT_ADMIN`; client-side the route uses the same authority
  // to hide the entry from non-admins (see `navigation.config.ts`).
  //
  // The list endpoint (`GET /admin/payments`) is tracked as
  // DEBT-11-PAY-1 — the FE is wired against the contract; the
  // controller lands in the next payments hardening sprint.
  // -------------------------------------------------------------------------

  /** Tenant-wide payment listing. Returns a Spring data page envelope. */
  listAllPayments(
    query: AdminPaymentsQuery = {},
  ): Observable<{ content: Payment[]; totalElements: number }> {
    const params: Record<string, string> = {};
    if (query.status) params['status'] = query.status;
    if (query.provider) params['provider'] = query.provider;
    if (query.search) params['search'] = query.search;
    params['page'] = String(query.page ?? 0);
    params['size'] = String(query.size ?? 20);

    const qs = new URLSearchParams(params).toString();
    return this.api.get<{ content: Payment[]; totalElements: number }>(
      `${API.PAYMENTS.ADMIN.PAYMENTS}?${qs}`,
    );
  }

  /** Force a PENDING/IN_PROCESS payment into APPROVED. Idempotent. */
  reconcile(paymentPublicUuid: string, body: ReconcilePaymentRequest): Observable<Payment> {
    return this.api.post<Payment>(API.PAYMENTS.ADMIN.RECONCILE(paymentPublicUuid), body);
  }

  /** APPROVED → REFUNDED. Idempotent on already-REFUNDED. */
  refund(paymentPublicUuid: string, body: RefundPaymentRequest): Observable<Payment> {
    return this.api.post<Payment>(API.PAYMENTS.ADMIN.REFUND(paymentPublicUuid), body);
  }

  /** Create a CASH payment for the invoice and flip it to PAID. Idempotent. */
  markInvoicePaidCash(
    invoicePublicUuid: string,
    body: MarkInvoicePaidCashRequest,
  ): Observable<Payment> {
    return this.api.post<Payment>(API.PAYMENTS.ADMIN.MARK_PAID_CASH(invoicePublicUuid), body);
  }
}
