export interface B2BPaymentSummary {
  publicUuid: string;
  tenantName: string;
  invoicePeriod?: string;
  amountCents: number;
  method: string;
  reference: string;
  status: string;
  paidAt: string;
}

export interface RefundPaymentRequest {
  reason: string;
}
