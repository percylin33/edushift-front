import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminPaymentsStore } from './admin-payments.store';
import { PaymentsApiService } from '../services/payments-api.service';
import { Payment } from '../models/invoice.model';

/**
 * Smoke spec for the admin payments store (Sprint 11 / FE-11.5).
 *
 * <p>Verifies the four state transitions the page relies on:</p>
 *
 * <ol>
 *   <li>{@code load} sets items + total on success.</li>
 *   <li>{@code load} surfaces the error message on failure.</li>
 *   <li>Successful action writes the result + reloads.</li>
 *   <li>Failed action writes the result with the server error.</li>
 * </ol>
 */
describe('AdminPaymentsStore', () => {
  let store: AdminPaymentsStore;
  let apiStub: jasmine.SpyObj<PaymentsApiService>;

  const sample: Payment = {
    publicUuid: 'pay-1',
    invoiceId: 'inv-1',
    guardianUserId: 'u-1',
    provider: 'MERCADOPAGO',
    externalId: null,
    status: 'PENDING',
    amountCents: 1000,
    currency: 'PEN',
    paymentMethod: null,
    installments: null,
    paidAt: null,
    failureReason: null,
    createdAt: '2026-06-19T00:00:00Z',
  };

  beforeEach(() => {
    apiStub = jasmine.createSpyObj<PaymentsApiService>('PaymentsApiService', [
      'listAllPayments',
      'reconcile',
      'refund',
      'markInvoicePaidCash',
    ]);

    TestBed.configureTestingModule({
      providers: [AdminPaymentsStore, { provide: PaymentsApiService, useValue: apiStub }],
    });
    store = TestBed.inject(AdminPaymentsStore);
  });

  it('load(): success populates items + total + clears loading', () => {
    apiStub.listAllPayments.and.returnValue(of({ content: [sample], totalElements: 1 }));

    store.load();

    expect(store.items().length).toBe(1);
    expect(store.items()[0].publicUuid).toBe('pay-1');
    expect(store.totalElements()).toBe(1);
    expect(store.loading()).toBeFalse();
    expect(store.error()).toBeNull();
  });

  it('load(): error surfaces a human-readable message', () => {
    apiStub.listAllPayments.and.returnValue(throwError(() => ({ error: { message: 'boom' } })));

    store.load();

    expect(store.error()).toBe('boom');
    expect(store.loading()).toBeFalse();
  });

  it('reconcile(): success records last action and reloads', () => {
    apiStub.listAllPayments.and.returnValue(of({ content: [sample], totalElements: 1 }));
    apiStub.reconcile.and.returnValue(of({ ...sample, status: 'APPROVED' }));

    store.reconcile('pay-1', { reason: 'manual' });

    expect(apiStub.reconcile).toHaveBeenCalledWith('pay-1', { reason: 'manual' });
    expect(store.lastAction()?.ok).toBeTrue();
    expect(store.lastAction()?.newStatus).toBe('APPROVED');
    expect(apiStub.listAllPayments).toHaveBeenCalled();
  });

  it('reconcile(): failure records error in lastAction', () => {
    apiStub.reconcile.and.returnValue(throwError(() => ({ error: { message: 'invalid state' } })));

    store.reconcile('pay-1', { reason: 'x' });

    expect(store.lastAction()?.ok).toBeFalse();
    expect(store.lastAction()?.message).toBe('invalid state');
    expect(store.error()).toBe('invalid state');
    expect(store.pendingAction()).toBeNull();
  });

  it('clearLastAction() resets the banner', () => {
    store.clearLastAction();
    expect(store.lastAction()).toBeNull();
  });

  it('reset() wipes everything', () => {
    apiStub.listAllPayments.and.returnValue(of({ content: [sample], totalElements: 1 }));
    store.load();
    expect(store.hasItems()).toBeTrue();

    store.reset();

    expect(store.items().length).toBe(0);
    expect(store.hasItems()).toBeFalse();
    expect(store.totalElements()).toBe(0);
    expect(store.error()).toBeNull();
  });
});
