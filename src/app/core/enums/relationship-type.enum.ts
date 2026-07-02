/**
 * Nature of the relationship between a guardian and a student. Mirrors
 * the backend {@code RelationshipType} enum verbatim.
 *
 * <p>Lives on the link (StudentGuardian) — same person can be
 * {@code Mother} of one student and {@code Guardian} of another.
 * {@code Other} is the escape hatch (uncle, foster, etc.); anything
 * more nuanced belongs in a future free-text "notes" column.
 */
export enum RelationshipType {
  Father = 'FATHER',
  Mother = 'MOTHER',
  Grandparent = 'GRANDPARENT',
  Guardian = 'GUARDIAN',
  Other = 'OTHER',
}
