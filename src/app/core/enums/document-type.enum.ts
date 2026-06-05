/**
 * Identity-document kind for a student. Mirrors the backend
 * {@code DocumentType} enum verbatim (UPPER_CASE wire values).
 *
 * <p>The set is intentionally small (DNI, CE, PASSPORT, OTHER) — anything
 * beyond these four belongs in the free-form {@code metadata} JSONB on
 * the student aggregate, not as a new enum value.
 */
export enum DocumentType {
  Dni      = 'DNI',
  Ce       = 'CE',
  Passport = 'PASSPORT',
  Other    = 'OTHER'
}
