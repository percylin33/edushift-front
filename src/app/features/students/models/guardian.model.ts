import { DocumentType, RelationshipType } from '@core/enums';

// =============================================================================
// Raw wire shapes
// =============================================================================

/**
 * RAW backend {@code GuardianResponse} record returned by all the
 * guardian endpoints under {@code /students/{publicUuid}/guardians}.
 *
 * <p>It's a composite projection: guardian identity + the link metadata
 * that connects it to <em>this</em> student. Two distinct UUIDs travel
 * together so the UI can target each side separately:
 * <ul>
 *   <li>{@code linkPublicUuid} — used for {@code PUT} / {@code DELETE}
 *       on the relationship row.</li>
 *   <li>{@code guardianPublicUuid} — handle of the guardian profile
 *       itself (Sprint 4+ when we expose a guardians module).</li>
 * </ul>
 */
export interface GuardianResponseRaw {
  linkPublicUuid: string;
  guardianPublicUuid: string;
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  occupation: string | null;
  relationship: RelationshipType;
  isPrimaryContact: boolean;
  canPickupStudent: boolean;
}

// =============================================================================
// UI model — what components consume
// =============================================================================

/**
 * UI-side guardian, with optional fields surfaced as {@code undefined}
 * (idiomatic across the rest of the codebase). The two UUIDs stay
 * distinct so the components can route writes to the right endpoint
 * without inferring intent from the URL.
 */
export interface Guardian {
  linkPublicUuid: string;
  guardianPublicUuid: string;
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  phone?: string;
  occupation?: string;
  relationship: RelationshipType;
  isPrimaryContact: boolean;
  canPickupStudent: boolean;
}

// =============================================================================
// Request shapes
// =============================================================================

/**
 * Body of {@code POST /v1/students/{publicUuid}/guardians}. Mirrors
 * the backend {@code AddGuardianRequest} verbatim.
 *
 * <h3>"Find or create" semantics</h3>
 * The backend looks up an existing guardian by
 * {@code (documentType, documentNumber)} in the current tenant. If
 * found, the link is created against it (sibling sharing); otherwise
 * the row is freshly created from the profile fields. That's why the
 * profile fields are always required on the wire — admins committing
 * to a document number also commit to a name in case the row needs
 * to be inserted.
 */
export interface AddGuardianRequest {
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  occupation?: string;
  relationship: RelationshipType;
  isPrimaryContact: boolean;
  canPickupStudent: boolean;
}

/**
 * Body of {@code PUT /v1/students/{studentUuid}/guardians/{guardianUuid}}.
 *
 * <p>Updates the link only — guardian profile fields stay untouched.
 * {@code undefined} = no change (omitted from the JSON payload). The
 * backend uses boxed {@link Boolean} on its end so we can express
 * "no change" for the booleans too instead of always sending a value.
 */
export interface UpdateGuardianLinkRequest {
  relationship?: RelationshipType;
  isPrimaryContact?: boolean;
  canPickupStudent?: boolean;
}
