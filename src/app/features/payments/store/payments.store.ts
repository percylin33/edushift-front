import { Injectable, computed, signal } from '@angular/core';
import { Invoice, Transaction } from '../models';

@Injectable({ providedIn: 'root' })
export class PaymentsStore {
  private readonly _invoices = signal<Invoice[]>([]);
  private readonly _transactions = signal<Transaction[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly invoices = this._invoices.asReadonly();
  readonly transactions = this._transactions.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly overdueCount = computed(
    () => this._invoices().filter((i) => i.status === 'overdue').length,
  );
  readonly totalDue = computed(() =>
    this._invoices()
      .filter((i) => i.status === 'issued' || i.status === 'overdue')
      .reduce((acc, i) => acc + i.amount, 0),
  );

  setInvoices(invoices: Invoice[]): void {
    this._invoices.set(invoices);
  }
  setTransactions(transactions: Transaction[]): void {
    this._transactions.set(transactions);
  }
  setLoading(value: boolean): void {
    this._loading.set(value);
  }
  setError(error: string | null): void {
    this._error.set(error);
  }

  reset(): void {
    this._invoices.set([]);
    this._transactions.set([]);
    this._loading.set(false);
    this._error.set(null);
  }
}
