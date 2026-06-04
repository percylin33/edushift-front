/**
 * Common shape for every persisted entity in the system.
 * Multi-tenant guarantee: every row carries its `tenantId` so the frontend
 * can defensively scope state per tenant when needed.
 */
export interface BaseEntity {
  id: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

/** Minimal audit metadata; extend per feature when richer history is needed. */
export interface AuditMeta {
  createdBy?: string;
  updatedBy?: string;
  version?: number;
}
