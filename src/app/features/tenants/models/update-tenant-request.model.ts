import { BrandingRaw } from './tenant-response.model';

/**
 * Body of `PATCH /v1/tenants/me` — partial-flat update, TENANT_ADMIN only.
 *
 * <p>Every field is optional: the backend's {@code TenantMapper.applyUpdate}
 * treats {@code null} / {@code undefined} as "leave the existing value
 * alone". Special merge semantics worth remembering at the call site:
 *
 * <ul>
 *   <li><strong>{@code branding}</strong> — field-level merge. Sending
 *       {@code branding: { primaryColor: '#ff6900' }} keeps the existing
 *       {@code logoUrl} / {@code faviconUrl} / {@code loginBgUrl}
 *       intact.</li>
 *   <li><strong>{@code settings} / {@code featureFlags}</strong> —
 *       wholesale replacement. The backend never tries to merge keys
 *       inside these maps because the schema is intentionally free-form
 *       and we don't want to guess intent. If you only want to flip one
 *       key, fetch first and patch the merged map.</li>
 *   <li><strong>Non-editable fields</strong> — {@code slug},
 *       {@code status}, {@code plan} are intentionally absent here. They
 *       move through dedicated lifecycle endpoints (later sprints).</li>
 * </ul>
 */
export interface UpdateTenantRequest {
  name?: string;
  customDomain?: string | null;
  branding?: BrandingRaw;
  settings?: Record<string, unknown>;
  featureFlags?: Record<string, unknown>;
  maxStudents?: number | null;
  maxTeachers?: number | null;
}
