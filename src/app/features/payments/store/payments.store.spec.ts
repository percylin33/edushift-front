import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PaymentsStore } from './payments.store';
import { Invoice, Transaction } from '../models';

describe('PaymentsStore', () => {
  let store: PaymentsStore;

  const invOverdue: Invoice = {
    publicUuid: 'inv-1',
    subscriptionId: null,
    studentId: 's-1',
    guardianUserId: 'u-1',
    periodLabel: 'Marzo',
    currency: 'PEN',
    subtotalCents: 0,
    discountCents: 0,
    taxCents: 0,
    totalCents: 0,
    status: 'OVERDUE',
    issuedAt: '',
    dueAt: '',
    paidAt: null,
    notes: null,
    items: [],
  };

  const invIssued: Invoice = { ...invOverdue, publicUuid: 'inv-2', status: 'PENDING' };
  const invPaid: Invoice = { ...invOverdue, publicUuid: 'inv-3', status: 'PAID' };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [PaymentsStore] });
    store = TestBed.inject(PaymentsStore);
  });

  it('inicia con estado vacío', () => {
    expect(store.invoices()).toEqual([]);
    expect(store.transactions()).toEqual([]);
    expect(store.loading()).toBeFalse();
    expect(store.error()).toBeNull();
    expect(store.overdueCount()).toBe(0);
    expect(store.totalDue()).toBe(0);
  });

  it('setInvoices / setTransactions / setLoading / setError', () => {
    const txs: Transaction[] = [{ id: 'tx-1', amount: 100 } as any];
    store.setInvoices([invOverdue]);
    store.setTransactions(txs);
    store.setLoading(true);
    store.setError('algo');
    expect(store.invoices()).toHaveSize(1);
    expect(store.transactions()).toHaveSize(1);
    expect(store.loading()).toBeTrue();
    expect(store.error()).toBe('algo');
  });

  it('overdueCount cuenta solo OVERDUE', () => {
    store.setInvoices([invOverdue, invIssued, invPaid]);
    expect(store.overdueCount()).toBe(1);
  });

  it('totalDue suma issued + overdue', () => {
    const a = { ...invIssued, amount: 100 } as any;
    const b = { ...invOverdue, amount: 200 } as any;
    const c = { ...invPaid, amount: 999 } as any;
    store.setInvoices([a, b, c]);
    expect(store.totalDue()).toBe(300);
  });

  it('reset limpia todo', () => {
    store.setInvoices([invOverdue]);
    store.setTransactions([{ id: 'tx-1' } as any]);
    store.setLoading(true);
    store.setError('x');
    store.reset();
    expect(store.invoices()).toEqual([]);
    expect(store.transactions()).toEqual([]);
    expect(store.loading()).toBeFalse();
    expect(store.error()).toBeNull();
  });
});
