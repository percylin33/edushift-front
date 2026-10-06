import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiService } from '@core/services';
import { API } from '@core/constants/api.constants';
import { ApiResponse } from '@core/models';
import {
  AdminInvoicesQuery,
  AdminPaymentsQuery,
  AgingBuckets,
  BulkCreateSubscriptionsRequest,
  BulkCreateSubscriptionsResponse,
  BulkEmitInvoicesRequest,
  BulkEmitInvoicesResponse,
  CheckoutResponse,
  CreateSubscriptionRequest,
  EmitInvoiceRequest,
  Invoice,
  MarkInvoicePaidCashRequest,
  Payment,
  PaymentAccessOverride,
  PaymentAccessStatus,
  PaymentPolicy,
  PaymentSubscription,
  ReconcilePaymentRequest,
  RefundPaymentRequest,
  RejectPaymentEvidenceRequest,
  SiblingSuggestionGroup,
  SubmitPaymentEvidenceRequest,
  SubscriptionStatus,
} from '../models/invoice.model';

/**
 * Payments REST service (Sprint 10 / FE-10.1 + Sprint 11 / FE-11.1 +
 * school billing console).
 *
 * <p>User-facing methods: {@code listMyInvoices}, {@code getInvoice},
 * {@code listPaymentsForInvoice}, {@code checkout}, {@code getAccessStatus}.
 * Admin methods are gated by {@code LMS_PAYMENT_ADMIN}.</p>
 */
@Injectable({ providedIn: 'root' })
export class PaymentsApiService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  // -------------------------------------------------------------------------
  // User-facing (Sprint 10 / FE-10.1)
  // -------------------------------------------------------------------------

  listMyInvoices(page = 0, size = 20): Observable<{ content: Invoice[]; totalElements: number }> {
    return this.api
      .get<
        | ApiResponse<{ content: Invoice[]; totalElements: number }>
        | { content: Invoice[]; totalElements: number }
      >(`${API.PAYMENTS.INVOICES}?page=${page}&size=${size}`)
      .pipe(map((r) => this.unwrap(r)));
  }

  getInvoice(publicUuid: string): Observable<Invoice> {
    return this.api
      .get<ApiResponse<Invoice> | Invoice>(API.PAYMENTS.INVOICE_BY_ID(publicUuid))
      .pipe(map((r) => this.unwrap(r)));
  }

  listPaymentsForInvoice(publicUuid: string): Observable<Payment[]> {
    return this.api
      .get<ApiResponse<Payment[]> | Payment[]>(API.PAYMENTS.INVOICE_PAYMENTS(publicUuid))
      .pipe(map((r) => this.unwrap(r)));
  }

  /**
   * Start a Checkout Pro flow. Returns the URL the FE should
   * open in a new tab.
   */
  checkout(publicUuid: string): Observable<CheckoutResponse> {
    return this.api
      .post<ApiResponse<CheckoutResponse> | CheckoutResponse>(
        API.PAYMENTS.INVOICE_CHECKOUT(publicUuid),
        {},
      )
      .pipe(map((r) => this.unwrap(r)));
  }

  downloadReceipt(publicUuid: string): Observable<Blob> {
    return this.http.get(API.PAYMENTS.INVOICE_RECEIPT(publicUuid), { responseType: 'blob' });
  }

  submitEvidence(
    publicUuid: string,
    body: SubmitPaymentEvidenceRequest,
  ): Observable<Invoice> {
    return this.api
      .post<ApiResponse<Invoice> | Invoice>(API.PAYMENTS.INVOICE_EVIDENCE(publicUuid), body)
      .pipe(map((r) => this.unwrap(r)));
  }

  /** Soft LMS gate: `{ lmsRestricted: true }` when overdue lock applies. */
  getAccessStatus(): Observable<PaymentAccessStatus> {
    return this.api
      .get<ApiResponse<PaymentAccessStatus> | PaymentAccessStatus>(API.PAYMENTS.ACCESS_STATUS)
      .pipe(map((r) => this.unwrap(r)));
  }

  // -------------------------------------------------------------------------
  // Admin (Sprint 11 / FE-11.1, BE-11.7 + school billing).
  // -------------------------------------------------------------------------

  listAdminInvoices(
    query: AdminInvoicesQuery = {},
  ): Observable<{ content: Invoice[]; totalElements: number }> {
    const params: Record<string, string> = {};
    if (query.status) params['status'] = query.status;
    params['page'] = String(query.page ?? 0);
    params['size'] = String(query.size ?? 20);
    const qs = new URLSearchParams(params).toString();
    return this.api
      .get<
        | ApiResponse<{ content: Invoice[]; totalElements: number }>
        | { content: Invoice[]; totalElements: number }
      >(`${API.PAYMENTS.ADMIN.INVOICES}?${qs}`)
      .pipe(map((r) => this.unwrap(r)));
  }

  rejectEvidence(
    invoicePublicUuid: string,
    body: RejectPaymentEvidenceRequest,
  ): Observable<Invoice> {
    return this.api
      .post<ApiResponse<Invoice> | Invoice>(
        API.PAYMENTS.ADMIN.REJECT_EVIDENCE(invoicePublicUuid),
        body,
      )
      .pipe(map((r) => this.unwrap(r)));
  }

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
    return this.api
      .get<
        | ApiResponse<{ content: Payment[]; totalElements: number }>
        | { content: Payment[]; totalElements: number }
      >(`${API.PAYMENTS.ADMIN.PAYMENTS}?${qs}`)
      .pipe(map((r) => this.unwrap(r)));
  }

  /** Force a PENDING/IN_PROCESS payment into APPROVED. Idempotent. */
  reconcile(paymentPublicUuid: string, body: ReconcilePaymentRequest): Observable<Payment> {
    return this.api
      .post<ApiResponse<Payment> | Payment>(
        API.PAYMENTS.ADMIN.RECONCILE(paymentPublicUuid),
        body,
      )
      .pipe(map((r) => this.unwrap(r)));
  }

  /** APPROVED → REFUNDED. Idempotent on already-REFUNDED. */
  refund(paymentPublicUuid: string, body: RefundPaymentRequest): Observable<Payment> {
    return this.api
      .post<ApiResponse<Payment> | Payment>(API.PAYMENTS.ADMIN.REFUND(paymentPublicUuid), body)
      .pipe(map((r) => this.unwrap(r)));
  }

  /**
   * Create a CASH payment for the invoice and flip it to PAID.
   * Backend returns void; callers that need a Payment shape get null.
   */
  markInvoicePaidCash(
    invoicePublicUuid: string,
    body: MarkInvoicePaidCashRequest = {},
  ): Observable<Payment | null> {
    const qs = body.note
      ? `?notes=${encodeURIComponent(body.note)}`
      : '';
    return this.api
      .post<null>(`${API.PAYMENTS.ADMIN.MARK_PAID_CASH(invoicePublicUuid)}${qs}`, {})
      .pipe(map(() => null));
  }

  emitInvoice(body: EmitInvoiceRequest): Observable<Invoice> {
    return this.api
      .post<ApiResponse<Invoice> | Invoice>(API.PAYMENTS.ADMIN.EMIT, body)
      .pipe(map((r) => this.unwrap(r)));
  }

  bulkEmit(body: BulkEmitInvoicesRequest): Observable<BulkEmitInvoicesResponse> {
    return this.api
      .post<ApiResponse<BulkEmitInvoicesResponse> | BulkEmitInvoicesResponse>(
        API.PAYMENTS.ADMIN.BULK,
        body,
      )
      .pipe(map((r) => this.unwrap(r)));
  }

  listSubscriptions(
    status?: SubscriptionStatus,
    page = 0,
    size = 50,
  ): Observable<{ content: PaymentSubscription[]; totalElements: number }> {
    const params: Record<string, string | number> = { page, size };
    if (status) params['status'] = status;
    return this.api
      .get<
        | ApiResponse<{ content: PaymentSubscription[]; totalElements: number }>
        | { content: PaymentSubscription[]; totalElements: number }
      >(API.PAYMENTS.ADMIN.SUBSCRIPTIONS.ROOT, params)
      .pipe(map((r) => this.unwrap(r)));
  }

  createSubscription(body: CreateSubscriptionRequest): Observable<PaymentSubscription> {
    return this.api
      .post<ApiResponse<PaymentSubscription> | PaymentSubscription>(
        API.PAYMENTS.ADMIN.SUBSCRIPTIONS.ROOT,
        body,
      )
      .pipe(map((r) => this.unwrap(r)));
  }

  bulkCreateSubscriptions(
    body: BulkCreateSubscriptionsRequest,
  ): Observable<BulkCreateSubscriptionsResponse> {
    return this.api
      .post<ApiResponse<BulkCreateSubscriptionsResponse> | BulkCreateSubscriptionsResponse>(
        API.PAYMENTS.ADMIN.SUBSCRIPTIONS.BULK,
        body,
      )
      .pipe(map((r) => this.unwrap(r)));
  }

  listSiblingSuggestions(): Observable<SiblingSuggestionGroup[]> {
    return this.api
      .get<ApiResponse<SiblingSuggestionGroup[]> | SiblingSuggestionGroup[]>(
        API.PAYMENTS.ADMIN.SUBSCRIPTIONS.SIBLING_SUGGESTIONS,
      )
      .pipe(map((r) => this.unwrap(r) ?? []));
  }

  refreshSiblingSuggestions(): Observable<{ markedSuggested: number }> {
    return this.api
      .post<
        | ApiResponse<{ markedSuggested: number }>
        | { markedSuggested: number }
      >(API.PAYMENTS.ADMIN.SUBSCRIPTIONS.SIBLING_REFRESH, {})
      .pipe(map((r) => this.unwrap(r)));
  }

  decideSiblingDiscount(
    studentPublicUuids: string[],
    decision: 'APPLIED' | 'REJECTED',
  ): Observable<{ updated: number }> {
    return this.api
      .post<ApiResponse<{ updated: number }> | { updated: number }>(
        API.PAYMENTS.ADMIN.SUBSCRIPTIONS.SIBLING_DECIDE,
        { studentPublicUuids, decision },
      )
      .pipe(map((r) => this.unwrap(r)));
  }

  pauseSubscription(publicUuid: string): Observable<PaymentSubscription> {
    return this.api
      .post<ApiResponse<PaymentSubscription> | PaymentSubscription>(
        API.PAYMENTS.ADMIN.SUBSCRIPTIONS.PAUSE(publicUuid),
        {},
      )
      .pipe(map((r) => this.unwrap(r)));
  }

  resumeSubscription(publicUuid: string): Observable<PaymentSubscription> {
    return this.api
      .post<ApiResponse<PaymentSubscription> | PaymentSubscription>(
        API.PAYMENTS.ADMIN.SUBSCRIPTIONS.RESUME(publicUuid),
        {},
      )
      .pipe(map((r) => this.unwrap(r)));
  }

  cancelSubscription(publicUuid: string): Observable<PaymentSubscription> {
    return this.api
      .post<ApiResponse<PaymentSubscription> | PaymentSubscription>(
        API.PAYMENTS.ADMIN.SUBSCRIPTIONS.CANCEL(publicUuid),
        {},
      )
      .pipe(map((r) => this.unwrap(r)));
  }

  runDue(): Observable<{ issued: number }> {
    return this.api
      .post<ApiResponse<{ issued: number }> | { issued: number }>(API.PAYMENTS.ADMIN.RUN_DUE, {})
      .pipe(map((r) => this.unwrap(r)));
  }

  getPolicy(): Observable<PaymentPolicy> {
    return this.api
      .get<ApiResponse<PaymentPolicy> | PaymentPolicy>(API.PAYMENTS.ADMIN.POLICY)
      .pipe(map((r) => this.unwrap(r)));
  }

  updatePolicy(body: PaymentPolicy): Observable<PaymentPolicy> {
    return this.api
      .put<ApiResponse<PaymentPolicy> | PaymentPolicy, PaymentPolicy>(
        API.PAYMENTS.ADMIN.POLICY,
        body,
      )
      .pipe(map((r) => this.unwrap(r)));
  }

  exportCsv(): Observable<string> {
    return this.http.get(API.PAYMENTS.ADMIN.REPORTS.EXPORT_CSV, { responseType: 'text' });
  }

  aging(): Observable<AgingBuckets> {
    return this.api
      .get<ApiResponse<AgingBuckets> | AgingBuckets>(API.PAYMENTS.ADMIN.REPORTS.AGING)
      .pipe(map((r) => this.unwrap(r)));
  }

  moraExempt(invoicePublicUuid: string): Observable<void> {
    return this.api
      .post<ApiResponse<null> | null>(API.PAYMENTS.ADMIN.MORA_EXEMPT(invoicePublicUuid), {})
      .pipe(map(() => undefined));
  }

  /** POST /access-overrides — BE takes query params (`@RequestParam`). */
  createAccessOverride(params: {
    userPublicUuid: string;
    studentPublicUuid?: string | null;
    untilAt: string;
    reason?: string | null;
  }): Observable<PaymentAccessOverride> {
    const qs = new URLSearchParams();
    qs.set('userPublicUuid', params.userPublicUuid);
    qs.set('untilAt', params.untilAt);
    if (params.studentPublicUuid) qs.set('studentPublicUuid', params.studentPublicUuid);
    if (params.reason) qs.set('reason', params.reason);
    return this.http
      .post<ApiResponse<PaymentAccessOverride> | PaymentAccessOverride>(
        `${API.PAYMENTS.ADMIN.ACCESS_OVERRIDES}?${qs.toString()}`,
        {},
      )
      .pipe(map((r) => this.unwrap(r)));
  }

  private unwrap<T>(r: ApiResponse<T> | T): T {
    if (r != null && typeof r === 'object' && 'data' in (r as object) && 'success' in (r as object)) {
      return (r as ApiResponse<T>).data;
    }
    return r as T;
  }
}
