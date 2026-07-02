import { DocumentType, EmploymentStatus, Gender } from '@core/enums';

// =============================================================================
// Raw wire shapes — espejo 1:1 del backend (BE-4.6)
// =============================================================================

/**
 * RAW backend {@code TeacherListItem} record devuelto por
 * {@code GET /v1/teachers}.
 *
 * <p>Proyección lean para la tabla del padrón: omite metadata,
 * birthDate, hireDate y los timestamps de audit. El detalle
 * ({@link TeacherResponseRaw}) carga la silueta completa.</p>
 */
export interface TeacherListItemRaw {
  publicUuid: string;
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  secondLastName: string | null;
  email: string | null;
  title: string | null;
  specializations: string[] | null;
  employmentStatus: EmploymentStatus;
  hasUserAccount: boolean;
}

/**
 * RAW backend {@code TeacherResponse} record devuelto por los
 * endpoints de detalle y mutación. Superset de {@link TeacherListItemRaw}
 * con demografía completa, timestamps y el {@code userPublicUuid} del
 * link al aggregate {@code users}.
 */
export interface TeacherResponseRaw {
  publicUuid: string;
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  secondLastName: string | null;
  birthDate: string | null;
  gender: Gender | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  specializations: string[] | null;
  hireDate: string | null;
  employmentStatus: EmploymentStatus;
  /** Public UUID del User vinculado, {@code null} si el docente todavía no tiene cuenta. */
  userPublicUuid: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * RAW backend {@code InviteTeacherResponse} — devuelto por
 * {@code POST /v1/teachers/{publicUuid}/invite}. Mismo shape que el
 * response de invitations standard pero limitado a los campos que
 * necesita el flow de teacher-invite.
 */
export interface InviteTeacherResponseRaw {
  invitationPublicUuid: string;
  invitationToken: string;
  expiresAt: string | null;
  teacherPublicUuid: string;
  email: string;
}

// =============================================================================
// UI shapes
// =============================================================================

/**
 * UI-side row para la tabla del padrón. Mismo shape que
 * {@link TeacherListItemRaw} con {@code null}s narrowed a
 * {@code undefined} y {@code fullName} computado client-side (el BE
 * no lo envía en la list para mantener el payload chico — los demás
 * proyectados sí, pero teachers prefirió symetria con la entity).
 */
export interface TeacherRow {
  publicUuid: string;
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  secondLastName?: string;
  fullName: string;
  email?: string;
  title?: string;
  specializations: string[];
  employmentStatus: EmploymentStatus;
  hasUserAccount: boolean;
}

/**
 * UI-side detail (superset de {@link TeacherRow}) usado por las
 * páginas de detail / edit. {@code metadata} se mantiene como bag
 * crudo para que admins no pisen campos no editados.
 */
export interface TeacherDetail extends TeacherRow {
  birthDate?: Date;
  gender?: Gender;
  phone?: string;
  hireDate?: Date;
  /** Public UUID del User vinculado cuando el docente tiene cuenta. */
  userPublicUuid?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Resultado del POST {@code /invite} adaptado a Date. */
export interface TeacherInvitationResult {
  invitationPublicUuid: string;
  invitationToken: string;
  expiresAt?: Date;
  teacherPublicUuid: string;
  email: string;
}

// =============================================================================
// Request shapes
// =============================================================================

/**
 * Body del {@code POST /v1/teachers}. Espejo del backend
 * {@code CreateTeacherRequest}.
 *
 * <h3>Reglas de campo</h3>
 * <ul>
 *   <li>{@code documentType} + {@code documentNumber} son requeridos
 *       y forman la identidad natural (uniqueness por tenant).</li>
 *   <li>{@code firstName} / {@code lastName} requeridos (1..100).</li>
 *   <li>El resto opcional. {@code employmentStatus} default
 *       ({@code ACTIVE}) lo aplica el back si se omite.</li>
 * </ul>
 */
export interface CreateTeacherRequest {
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  secondLastName?: string;
  birthDate?: string;
  gender?: Gender;
  email?: string;
  phone?: string;
  title?: string;
  specializations?: string[];
  hireDate?: string;
  employmentStatus?: EmploymentStatus;
  metadata?: Record<string, unknown>;
}

/**
 * Patch payload de {@code PUT /v1/teachers/{publicUuid}}.
 *
 * <p>Partial-merge: campos {@code undefined} se omiten del JSON
 * (no-op server-side); pasar {@code null} explícito limpia el campo
 * para los nullable ({@code email}, {@code phone}, {@code secondLastName},
 * etc.). Linkear el User <em>no</em> se hace por aquí — usar
 * {@code POST /teachers/{uuid}/link-user}.</p>
 */
export interface UpdateTeacherRequest {
  documentType?: DocumentType;
  documentNumber?: string;
  firstName?: string;
  lastName?: string;
  secondLastName?: string;
  birthDate?: string;
  gender?: Gender;
  email?: string;
  phone?: string;
  title?: string;
  specializations?: string[];
  hireDate?: string;
  employmentStatus?: EmploymentStatus;
  metadata?: Record<string, unknown>;
}

/** Body de {@code POST /v1/teachers/{publicUuid}/link-user}. */
export interface LinkTeacherUserRequest {
  userPublicUuid: string;
}

/**
 * Filtros para {@code GET /v1/teachers}. Cualquiera puede omitirse;
 * blancos se omiten al serializar para que la URL quede limpia.
 *
 * <p>{@code search} es case-insensitive substring sobre
 * firstName/lastName/secondLastName/document/email.</p>
 */
export interface TeacherListFilters {
  search?: string;
  employmentStatus?: EmploymentStatus;
  /** {@code true} → solo con cuenta vinculada; {@code false} → solo sin cuenta. */
  hasUserAccount?: boolean;
}

/** Pagination + sort (Spring shorthand {@code "field,DIR"}). */
export interface TeacherListPagination {
  page?: number;
  size?: number;
  sort?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Catálogo seed de especialidades sugeridas por el chip-input. Los
 * admins pueden tipear cualquier valor (es free-form en el back),
 * pero esta lista cubre el ~90% de casos y acelera onboarding.
 *
 * <p>No es una taxonomía cerrada: el chip-input agrega entradas
 * libres al array. Si la lista crece, conviene moverla a un endpoint
 * de catálogo y cachearla cliente-side.</p>
 */
export const SPECIALIZATION_CATALOG: ReadonlyArray<string> = [
  'Matemática',
  'Comunicación',
  'Inglés',
  'Ciencia y Tecnología',
  'Ciencias Sociales',
  'Educación Física',
  'Arte y Cultura',
  'Educación Religiosa',
  'Tutoría',
  'Computación',
  'Música',
  'Filosofía',
];

/**
 * Calcula {@code fullName} de un docente al estilo del backend
 * ({@code firstName + lastName + secondLastName} con dobles espacios
 * normalizados). El BE proyecta este campo en {@code TeacherResponse}
 * pero no en {@code TeacherListItem} — el adapter del API service
 * usa este helper para no romper la promesa de la UI.
 */
export function computeTeacherFullName(
  firstName: string,
  lastName: string,
  secondLastName?: string | null,
): string {
  return [firstName, lastName, secondLastName ?? '']
    .map((s) => (s ?? '').trim())
    .filter((s) => s.length > 0)
    .join(' ');
}

/** Etiquetas en español para cada {@link EmploymentStatus}. */
export const EMPLOYMENT_STATUS_LABELS: Readonly<Record<EmploymentStatus, string>> = {
  [EmploymentStatus.Active]: 'Activo',
  [EmploymentStatus.OnLeave]: 'En licencia',
  [EmploymentStatus.Resigned]: 'Renunció',
  [EmploymentStatus.Retired]: 'Jubilado',
  [EmploymentStatus.Suspended]: 'Suspendido',
};
