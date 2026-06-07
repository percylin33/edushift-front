/**
 * Estado laboral de un docente dentro del tenant. Espejo del enum
 * {@code com.edushift.modules.teachers.entity.EmploymentStatus}
 * (BE-4.6).
 *
 * <h3>Transiciones (informativas — el back las acepta libremente)</h3>
 * <pre>
 *   ACTIVE  ⇄  ON_LEAVE
 *   ACTIVE  →  RESIGNED   (terminal-ish)
 *   ACTIVE  →  RETIRED    (terminal-ish)
 *   ACTIVE  →  SUSPENDED  (admin lockout, reversible)
 * </pre>
 *
 * <h3>Impacto operativo</h3>
 * <ul>
 *   <li>Solo {@link #Active} es <em>asignable</em> a secciones nuevas
 *       (BE-4.7). Los demás estados quedan visibles en el padrón pero
 *       el dropdown de assignments los oculta.</li>
 *   <li>{@link #Suspended} bloquea login si el docente tiene cuenta
 *       (Sprint 9 wirea el gate de auth).</li>
 * </ul>
 */
export enum EmploymentStatus {
  Active    = 'ACTIVE',
  OnLeave   = 'ON_LEAVE',
  Resigned  = 'RESIGNED',
  Retired   = 'RETIRED',
  Suspended = 'SUSPENDED'
}

/** {@code true} sii el docente puede recibir nuevas asignaciones (BE-4.7). */
export function isAssignableEmploymentStatus(status: EmploymentStatus): boolean {
  return status === EmploymentStatus.Active;
}
