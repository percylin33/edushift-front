export interface MeInvoice {
  readonly publicUuid: string;
  readonly periodLabel: string;
  readonly currency: string;
  readonly totalCents: number;
  readonly status: string;
  readonly issuedAt: string | null;
  readonly dueAt: string | null;
  readonly paidAt: string | null;
  readonly notes: string | null;
}
