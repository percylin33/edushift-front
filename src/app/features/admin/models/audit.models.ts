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

export interface AdminAuditEvent {
  id: string;
  occurredAt: string;
  tenantId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  action: string;
  tenantName?: string | null;
  tenantSlug?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  traceId?: string | null;
}

export interface AdminAuditPage {
  content: AdminAuditEvent[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
