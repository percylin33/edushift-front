import { BaseEntity } from '@core/models';

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'void';
export type PaymentMethod = 'card' | 'cash' | 'bank_transfer' | 'wallet' | 'other';

export interface Invoice extends BaseEntity {
  number: string;
  studentId: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string;
  paidAt?: string;
  description?: string;
}

export interface Transaction extends BaseEntity {
  invoiceId?: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  reference?: string;
  occurredAt: string;
}
