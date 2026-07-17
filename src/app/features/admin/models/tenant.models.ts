export interface AdminTenantSummary {
  publicUuid: string;
  slug: string;
  name: string;
  status: string;
  /** Plan code (BASIC / PRO / ENTERPRISE / TRIAL). */
  plan?: string;
  /** Human-readable plan name resolved server-side from `platform_plans`. */
  planName?: string;
  /** Count of ACTIVE students in the tenant — populated by BE on Sprint 16. */
  activeStudents?: number;
  /** ISO-8601 date string from `b2b_subscriptions.next_billing_at`. */
  nextBillingDate?: string;
  trialEndsAt?: string;
  createdAt?: string;
  updatedAt?: string;
  branding?: Record<string, unknown>;
  featureFlags?: Record<string, unknown>;
}

/**
 * Mirrors the backend `AdminTenantDetail` record returned by
 * `GET /api/v1/admin/tenants/{uuid}` (Sprint 15 / F-05 / H-07).
 *
 * Every field is optional in the UI because the BE only guarantees the
 * minimum projection (id, slug, status, plan, dates). New fields are
 * added without breaking older SPA builds — defensive defaults keep
 * `*?.toLocaleString()` calls inside the detail component from
 * throwing on partial responses.
 */
export interface AdminTenantDetail {
  id?: string;
  publicUuid: string;
  slug: string;
  name: string;
  customDomain?: string;
  status: string;
  plan?: string;
  planName?: string;
  planId?: string;
  trialEndsAt?: string;
  branding?: Record<string, unknown>;
  featureFlags?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  maxStudents?: number;
  maxTeachers?: number;
  maxStorageMb?: number;
  createdAt?: string;
  updatedAt?: string;
  activeStudents?: number;
  totalUsers?: number;
  totalTeachers?: number;
  email?: string;
  phone?: string;
  nextBillingDate?: string;
  subscription?: SubscriptionSummary;
}

export interface SubscriptionSummary {
  status: string;
  planName?: string;
  /** YYYY-MM-DD (LocalDate from BE). */
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  nextBillingAt?: string;
  trialEndsAt?: string;
  cancelAtPeriodEnd?: boolean;
  cancellationReason?: string;
}

export interface TenantListResponse {
  content: AdminTenantSummary[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface TenantFilterParams {
  search?: string;
  plan?: string;
  status?: string;
  page?: number;
  size?: number;
}
