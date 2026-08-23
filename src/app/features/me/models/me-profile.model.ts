/**
 * STUDENT personal profile envelope surfaced by `GET /api/v1/me/profile`
 * (DEBT-STUDENT-PRIVACY / Fase 1).
 *
 * Mirrors the backend `MeProfileResponse` Java record 1:1; the FE
 * consumes it to render the STUDENT shell (avatar, display name, section
 * badge, tenant branding, the list of `ME_*` permissions the caller
 * holds).
 */
export interface MeProfile {
  readonly publicUuid: string;
  readonly userPublicUuid: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string | null;
  readonly sectionPublicUuid: string | null;
  readonly sectionName: string | null;
  readonly gradeName: string | null;
  readonly academicYearLabel: string | null;
  readonly tenantPublicUuid: string;
  readonly tenantName: string;
  readonly tenantLogoUrl: string | null;
  readonly permissions: readonly string[];
}
