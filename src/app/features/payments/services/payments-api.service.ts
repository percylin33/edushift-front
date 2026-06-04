import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { Paginated } from '@core/models';
import { Invoice, Transaction } from '../models';

@Injectable({ providedIn: 'root' })
export class PaymentsApiService {
  private readonly api = inject(ApiService);

  listInvoices(params: { page?: number; pageSize?: number; status?: string } = {}): Observable<Paginated<Invoice>> {
    return this.api.get<Paginated<Invoice>>(API.PAYMENTS.INVOICES, params);
  }

  getInvoice(id: string): Observable<Invoice> {
    return this.api.get<Invoice>(`${API.PAYMENTS.INVOICES}/${id}`);
  }

  listTransactions(invoiceId?: string): Observable<Paginated<Transaction>> {
    return this.api.get<Paginated<Transaction>>(API.PAYMENTS.TRANSACTIONS, { invoiceId });
  }
}
