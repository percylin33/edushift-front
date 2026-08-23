export interface FamilyActivityItem {
  kind: 'TASK' | 'QUIZ' | string;
  publicUuid: string;
  title: string;
  sectionName: string | null;
  dueAt: string | null;
  overdue: boolean;
  status: string | null;
}

export interface FamilyPaymentItem {
  publicUuid: string;
  periodLabel: string;
  currency: string;
  totalCents: number;
  status: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
}
