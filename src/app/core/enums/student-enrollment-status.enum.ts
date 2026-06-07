/**
 * Lifecycle por-año de una matrícula
 * ({@code student_enrollments}). Espejo del enum
 * {@code com.edushift.modules.students.enrollments.entity.StudentEnrollmentStatus}
 * (BE-4.8).
 *
 * <p>Distinto a {@code Student.enrollmentStatus} (lifecycle global del
 * estudiante en la institución). Aquí cada row representa una
 * matrícula en una sección de un año académico específico:</p>
 *
 * <ul>
 *   <li>{@link #Active} — actualmente estudiando en la sección. El
 *       índice parcial único {@code uk_student_enrollments_active}
 *       limita a una sola row por (student, academicYear).</li>
 *   <li>{@link #Withdrawn} — el estudiante dejó la institución.</li>
 *   <li>{@link #Transferred} — se trasladó a otra sección u otra
 *       escuela. La UI usa este valor cuando se hace
 *       <em>cambio de sección</em>.</li>
 *   <li>{@link #Graduated} — completó el ciclo. Terminal.</li>
 * </ul>
 */
export enum StudentEnrollmentStatus {
  Active      = 'ACTIVE',
  Withdrawn   = 'WITHDRAWN',
  Transferred = 'TRANSFERRED',
  Graduated   = 'GRADUATED'
}

/** {@code true} sii la row es soft-ended (cualquier valor distinto de Active). */
export function isTerminalEnrollmentStatus(
  status: StudentEnrollmentStatus
): boolean {
  return status !== StudentEnrollmentStatus.Active;
}

/**
 * Set de status terminales válidos para el endpoint
 * {@code POST /v1/enrollments/{uuid}/withdraw} (BE rechaza
 * {@code ACTIVE} con 400 {@code INVALID_WITHDRAW_STATUS}).
 */
export const TERMINAL_ENROLLMENT_STATUSES: ReadonlyArray<StudentEnrollmentStatus> = [
  StudentEnrollmentStatus.Withdrawn,
  StudentEnrollmentStatus.Transferred,
  StudentEnrollmentStatus.Graduated
];
