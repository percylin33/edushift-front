export interface B2BInvoiceSummary {
  publicUuid: string;
  tenantName: string;
  period: string;
  activeStudents: number;
  totalCents: number;
  status: string;
  dueDate: string;
  paidAt?: string;
  paidAmountCents?: number;
}

export interface B2BInvoiceDetail {
  publicUuid: string;
  tenantName: string;
  period: string;
  activeStudents: number;
  pricePerStudentCents: number;
  totalCents: number;
  status: string;
  dueDate: string;
  issuedAt: string;
  paidAt?: string;
  paidAmountCents?: number;
  payments: B2BPayment[];
}

export interface B2BPayment {
  publicUuid: string;
  amountCents: number;
  method: string;
  reference: string;
  status: string;
  paidAt: string;
}

export interface MarkPaidRequest {
  method: string;
  reference: string;
  notes?: string;
}
