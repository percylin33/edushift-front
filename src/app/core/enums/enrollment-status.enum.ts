/**
 * Lifecycle of a student inside the institution. Mirrors the backend
 * {@code EnrollmentStatus} enum verbatim.
 *
 * <p>Distinct from the {@code deleted} flag (administrative removal):
 * a student can be {@code Enrolled} for years across multiple academic
 * cycles. {@code Pending} is the post-creation default before formal
 * paperwork is finished; {@code Graduated} / {@code Transferred} /
 * {@code Withdrawn} close the lifecycle.
 */
export enum EnrollmentStatus {
  Pending     = 'PENDING',
  Enrolled    = 'ENROLLED',
  Graduated   = 'GRADUATED',
  Transferred = 'TRANSFERRED',
  Withdrawn   = 'WITHDRAWN'
}
