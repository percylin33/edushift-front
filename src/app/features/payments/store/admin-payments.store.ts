import { Injectable, computed, inject, signal } from '@angular/core';
import { finalize, tap } from 'rxjs';
import { PaymentsApiService } from '../services/payments-api.service';
import {
  AdminPaymentsQuery,
  MarkInvoicePaidCashRequest,
  Payment,
  PaymentStatus,
  ReconcilePaymentRequest,
  RefundPaymentRequest,
} from '../models/invoice.model';

/**
 * Admin payments store (Sprint 11 / FE-11.1).
 *
 * <p>Holds the cross-page state for the {@code /payments/admin}
 * surface: the current page of payments, the active filter, the
 * pending action, and the last action result. Pages subscribe to
 * the readonly signals rather than re-fetching on every render.</p>
 *
 * <p>Listing side effect uses
 * {@code DEBT-11-PAY-1 → GET /api/v1/admin/payments} (planned
 * BE-11.11). Mutating actions (reconcile/refund/mark-paid-cash)
 * already exist on the controller (BE-11.7). When the listing
 * endpoint is missing, the API service will surface a 404 and the
 * page renders the {@code EMPTY_WITH_ENDPOINT_PENDING} state.</p>
 */
@Injectable({ providedIn: 'root' })
export class AdminPaymentsStore {
  private readonly api = inject(PaymentsApiService);

  // -------------------------------------------------------------------------
  // Listing state
  // -------------------------------------------------------------------------

  private readonly _items = signal<Payment[]>([]);
  private readonly _totalElements = signal(0);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  private readonly _filter = signal<AdminPaymentsQuery>({ page: 0, size: 20 });

  readonly items = this._items.asReadonly();
  readonly totalElements = this._totalElements.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly filter = this._filter.asReadonly();

  readonly hasItems = computed(() => this._items().length > 0);

  // -------------------------------------------------------------------------
  // Action state (reconcile / refund / mark-paid-cash)
  // -------------------------------------------------------------------------

  /** Which action is currently being submitted, if any. */
  private readonly _pendingAction = signal<AdminActionKind | null>(null);
  /** Last action result, used to surface a banner / toast in the page. */
  private readonly _lastAction = signal<AdminActionResult | null>(null);

  readonly pendingAction = this._pendingAction.asReadonly();
  readonly lastAction = this._lastAction.asReadonly();

  // -------------------------------------------------------------------------
  // Listing
  // -------------------------------------------------------------------------

  load(query: Partial<AdminPaymentsQuery> = {}): void {
    const next: AdminPaymentsQuery = { ...this._filter(), ...query };
    this._filter.set(next);
    this._loading.set(true);
    this._error.set(null);

    this.api
      .listAllPayments(next)
      .pipe(
        tap((page) => {
          this._items.set(page.content);
          this._totalElements.set(page.totalElements);
        }),
        finalize(() => this._loading.set(false)),
      )
      .subscribe({
        error: (e) => {
          this._error.set(
            e?.error?.message ?? e?.message ?? 'No se pudo cargar el listado de pagos.',
          );
        },
      });
  }

  // -------------------------------------------------------------------------
  // Mutating actions
  // -------------------------------------------------------------------------

  reconcile(paymentPublicUuid: string, body: ReconcilePaymentRequest): void {
    this.runAction('reconcile', () => this.api.reconcile(paymentPublicUuid, body));
  }

  refund(paymentPublicUuid: string, body: RefundPaymentRequest): void {
    this.runAction('refund', () => this.api.refund(paymentPublicUuid, body));
  }

  markInvoicePaidCash(invoicePublicUuid: string, body: MarkInvoicePaidCashRequest): void {
    this.runAction('mark-paid-cash', () => this.api.markInvoicePaidCash(invoicePublicUuid, body));
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private runAction(kind: AdminActionKind, fn: () => import('rxjs').Observable<Payment>): void {
    this._pendingAction.set(kind);
    this._error.set(null);
    this._lastAction.set(null);

    fn().subscribe({
      next: (payment) => {
        this._pendingAction.set(null);
        this._lastAction.set({
          kind,
          ok: true,
          paymentPublicUuid: payment.publicUuid,
          newStatus: payment.status,
        });
        // After a successful action, refresh the current page so the
        // table reflects the new state without requiring a manual reload.
        this.load();
      },
      error: (e) => {
        this._pendingAction.set(null);
        this._lastAction.set({
          kind,
          ok: false,
          message: e?.error?.message ?? e?.message ?? `Acción ${kind} falló.`,
        });
        this._error.set(this._lastAction()?.message ?? null);
      },
    });
  }

  clearLastAction(): void {
    this._lastAction.set(null);
  }

  reset(): void {
    this._items.set([]);
    this._totalElements.set(0);
    this._loading.set(false);
    this._error.set(null);
    this._filter.set({ page: 0, size: 20 });
    this._pendingAction.set(null);
    this._lastAction.set(null);
  }
}

// ---------------------------------------------------------------------------
// Action kinds + result shape (kept in the same file because they're
// tightly coupled to the store and would only confuse imports elsewhere).
// ---------------------------------------------------------------------------

export type AdminActionKind = 'reconcile' | 'refund' | 'mark-paid-cash';

export interface AdminActionResult {
  kind: AdminActionKind;
  ok: boolean;
  paymentPublicUuid?: string;
  newStatus?: PaymentStatus;
  message?: string;
}
