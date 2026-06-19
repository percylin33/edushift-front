export type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';
export type PaymentStatus =
  | 'PENDING' | 'IN_PROCESS' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'REFUNDED';
export type PaymentProvider = 'MERCADOPAGO' | 'MANUAL' | 'CASH';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitAmountCents: number;
  lineTotalCents: number;
}

export interface Invoice {
  publicUuid: string;
  subscriptionId: string | null;
  studentId: string;
  guardianUserId: string;
  periodLabel: string;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  notes: string | null;
  items: InvoiceItem[];
}

export interface Payment {
  publicUuid: string;
  invoiceId: string;
  guardianUserId: string;
  provider: PaymentProvider;
  externalId: string | null;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  paymentMethod: string | null;
  installments: number | null;
  paidAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface CheckoutResponse {
  paymentPublicUuid: string;
  initPoint: string;
  sandboxInitPoint: string;
}

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  PENDING:   'Pendiente',
  PAID:      'Pagada',
  OVERDUE:   'Vencida',
  CANCELLED: 'Cancelada',
  REFUNDED:  'Reembolsada'
};

export const STATUS_BADGE: Record<InvoiceStatus, string> = {
  PENDING:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  PAID:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  OVERDUE:   'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  CANCELLED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  REFUNDED:  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
};

/** Format minor units → "S/ 250.00" (PEN only in MVP). */
export function formatMoney(cents: number, currency = 'PEN'): string {
  const value = cents / 100;
  if (currency === 'PEN') return 'S/ ' + value.toFixed(2);
  return value.toFixed(2) + ' ' + currency;
}
