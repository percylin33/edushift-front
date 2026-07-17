export interface ImpersonationLog {
  publicUuid: string;
  adminEmail: string;
  impersonatedUserEmail: string;
  tenantName: string;
  startedAt: string;
  endedAt?: string;
  reason?: string;
}

export interface AuditFilterParams {
  adminEmail?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
}
