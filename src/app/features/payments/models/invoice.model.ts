export type InvoiceStatus =
  | 'PENDING'
  | 'PENDING_REVIEW'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'REFUNDED';
export type PaymentStatus =
  'PENDING' | 'IN_PROCESS' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'REFUNDED';
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
  /** Portion already paid as an admission reservation advance. */
  advanceAppliedCents?: number;
  /** Remaining amount to pay after reservation advances. */
  balanceCents?: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  notes: string | null;
  evidenceFilePublicUuid: string | null;
  evidenceSubmittedAt: string | null;
  evidenceNotes: string | null;
  evidenceRejectionReason: string | null;
  /** Late-fee amount in minor units (PEN centavos). */
  moraCents?: number;
  /** When true, automatic mora accrual is skipped. */
  moraExempt?: boolean;
  items: InvoiceItem[];
  /** Present on the staff invoice list so cashiers can identify the recipient. */
  studentIdentity?: {
    fullName: string;
    documentType: string;
    documentNumber: string;
  } | null;
}

/** Minimum invoice data returned to staff who can review vouchers but cannot read all payments. */
export type InvoiceReviewQueueItem = Pick<
  Invoice,
  | 'publicUuid'
  | 'studentId'
  | 'periodLabel'
  | 'currency'
  | 'totalCents'
  | 'status'
  | 'dueAt'
  | 'evidenceFilePublicUuid'
  | 'evidenceSubmittedAt'
  | 'evidenceNotes'
  | 'studentIdentity'
>;

export type AdminInvoiceListItem = Invoice | InvoiceReviewQueueItem;

export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';
export type BillingPeriod = 'MONTHLY' | 'ANNUAL';
export type SiblingDiscountStatus = 'NONE' | 'SUGGESTED' | 'APPLIED' | 'REJECTED';

export interface PaymentSubscription {
  publicUuid: string;
  studentId: string;
  guardianUserId: string;
  conceptId: string | null;
  planCode: string;
  amountCents: number;
  currency: string;
  billingPeriod: BillingPeriod;
  status: SubscriptionStatus;
  siblingDiscountStatus: SiblingDiscountStatus;
  billingDayOfMonth?: number | null;
  billingMonth?: number | null;
  startAt: string;
  nextBillingAt: string | null;
  cancelledAt: string | null;
}

export interface EmitInvoiceRequest {
  studentPublicUuid: string;
  conceptPublicUuid?: string | null;
  periodLabel: string;
  amountCents: number;
  discountCents?: number;
  dueAt?: string | null;
  notes?: string | null;
}

export interface BulkEmitInvoicesRequest {
  sectionPublicUuid?: string | null;
  allEnrolled: boolean;
  conceptPublicUuid?: string | null;
  periodLabel: string;
  amountCents?: number | null;
  discountCents?: number;
  dueAt?: string | null;
  notes?: string | null;
  dryRun: boolean;
}

export interface BulkEmitInvoicesResponse {
  dryRun: boolean;
  candidateCount: number;
  createdCount: number;
  skippedDuplicateCount: number;
  skippedNoGuardianCount: number;
  createdInvoicePublicUuids: string[];
}

export interface CreateSubscriptionRequest {
  studentPublicUuid: string;
  conceptPublicUuid: string;
  planCode?: string | null;
  amountCents?: number | null;
  billingPeriod: BillingPeriod;
  /** Preferred day of month 1–31 (clamped to last day of short months). */
  billingDayOfMonth: number;
  /** Required when billingPeriod is ANNUAL (1–12). */
  billingMonth?: number | null;
  currency?: string;
}

export interface BulkCreateSubscriptionsRequest {
  conceptPublicUuid: string;
  levelPublicUuid?: string | null;
  gradePublicUuid?: string | null;
  planCode?: string | null;
  amountCents?: number | null;
  billingPeriod: BillingPeriod;
  billingDayOfMonth: number;
  billingMonth?: number | null;
  currency?: string;
  dryRun: boolean;
}

export interface BulkCreateSubscriptionsResponse {
  dryRun: boolean;
  candidateCount: number;
  createdCount: number;
  skippedAlreadyActive: number;
  skippedNoGuardian: number;
  siblingSuggestionsCreated: number;
  createdSubscriptionPublicUuids: string[];
}

export interface BillingPlanRuleRequest {
  conceptPublicUuid: string;
  levelPublicUuid?: string | null;
  gradePublicUuid?: string | null;
  amountCents: number;
  billingPeriod: BillingPeriod;
  billingDayOfMonth: number;
  billingMonth?: number | null;
  currency: string;
}

export interface BillingPlanRuleResponse extends BillingPlanRuleRequest {
  publicUuid: string;
  active: boolean;
  candidateCount: number;
  createdCount: number;
  alreadyActiveCount: number;
  waitingGuardianCount: number;
}

export interface SiblingSuggestionChild {
  studentPublicUuid: string;
  studentName: string;
  subscriptionPublicUuid: string;
  planCode: string;
  amountCents: number;
  currency: string;
  siblingDiscountStatus: SiblingDiscountStatus;
}

export interface SiblingSuggestionGroup {
  guardianId: string;
  guardianName: string;
  guardianDocument: string;
  siblingCount: number;
  suggestedDiscountCents: number;
  children: SiblingSuggestionChild[];
}

export interface PaymentPolicy {
  reminderDaysBeforeDue: number[];
  moraEnabled: boolean;
  moraGraceDays: number;
  moraPercent: number;
  lockEnabled: boolean;
  lockOverdueDays: number;
  siblingDiscountEnabled: boolean;
  siblingDiscountCents: number;
  siblingMinCount: number;
}

export interface AgingBuckets {
  totalOverdueCents: number;
  totalOverdueInvoices: number;
  totalOverdueStudents: number;
  d0_30: AgingBucket;
  d31_60: AgingBucket;
  d61_90: AgingBucket;
  d90_plus: AgingBucket;
}

export interface AgingBucket {
  amountCents: number;
  invoiceCount: number;
  studentCount: number;
}

export interface PaymentAccessStatus {
  lmsRestricted: boolean;
}

export interface PaymentAccessOverride {
  publicUuid: string;
  userPublicUuid: string;
  userName: string;
  studentPublicUuid: string | null;
  studentName: string | null;
  reason: string | null;
  untilAt: string;
}

export interface PaymentAccessCandidate {
  userPublicUuid: string;
  studentPublicUuid: string;
  displayName: string;
  relationship: 'Estudiante' | 'Apoderado';
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

export interface SubmitPaymentEvidenceRequest {
  filePublicUuid: string;
  notes?: string;
}

export interface RejectPaymentEvidenceRequest {
  reason: string;
}

export interface ReconcilePaymentRequest {
  reason: string;
}

export interface RefundPaymentRequest {
  reason: string;
}

export interface MarkInvoicePaidCashRequest {
  note?: string;
}

export interface AdminPaymentsQuery {
  status?: PaymentStatus;
  provider?: PaymentProvider;
  search?: string;
  page?: number;
  size?: number;
}

export interface AdminInvoicesQuery {
  status?: InvoiceStatus;
  page?: number;
  size?: number;
}

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  PENDING: 'Pendiente',
  PENDING_REVIEW: 'En revisión',
  PAID: 'Pagada',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada',
  REFUNDED: 'Reembolsada',
};

export const STATUS_BADGE: Record<InvoiceStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  PENDING_REVIEW: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  PAID: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  OVERDUE: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  CANCELLED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  REFUNDED: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
};

/** Format minor units → "S/ 250.00" (PEN only in MVP). */
export function formatMoney(cents: number, currency = 'PEN'): string {
  const value = (Number.isFinite(cents) ? cents : 0) / 100;
  if (currency === 'PEN') return 'S/ ' + value.toFixed(2);
  return value.toFixed(2) + ' ' + currency;
}

/** UI soles → API centavos (S/ 20.00 → 2000). */
export function solesToCents(soles: number): number {
  if (!Number.isFinite(soles) || soles < 0) return 0;
  return Math.round(soles * 100);
}

/** API centavos → UI soles (2000 → 20). */
export function centsToSoles(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return Math.round(cents) / 100;
}
