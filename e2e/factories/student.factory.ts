import { APIRequestContext } from '@playwright/test';
import { CreatedEntity, seqId, seqDocumentNumber } from './_shared';

/**
 * Factory: create a student via {@code POST /api/v1/students}.
 *
 * <p>Used by:
 * <ul>
 *   <li>{@code e2e/tests/students/students-ui.spec.ts} — TA CRUD, bulk-import,
 *       guardians, attendance-QR.</li>
 *   <li>{@code e2e/tests/attendance/*.spec.ts} — TEACHER scan-QR check-in
 *       needs at least one student in the section.</li>
 *   <li>{@code e2e/tests/lms/*.spec.ts} — LMS tasks/quizzes enroll a student
 *       into a section first, then run submission flows.</li>
 * </ul>
 */
export interface StudentOverrides {
  firstName?: string;
  lastName?: string;
  secondLastName?: string;
  documentType?: 'DNI' | 'CE' | 'PASSPORT' | 'OTHER';
  documentNumber?: string;
  birthDate?: string;        // ISO yyyy-MM-dd
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  email?: string;
  phone?: string;
  address?: string;
  enrollmentStatus?: 'ACTIVE' | 'WITHDRAWN' | 'GRADUATED' | 'PENDING';
  metadata?: Record<string, unknown>;
}

export type CreatedStudent = CreatedEntity;

/**
 * Create a student. The caller owns {@link api}; the returned
 * {@link CreatedStudent.cleanup} uses an independent internal context
 * so disposing the test's context doesn't leak dangling entities.
 */
export async function makeStudent(
  api: APIRequestContext,
  overrides: StudentOverrides = {},
): Promise<CreatedStudent> {
  const id = seqId('student');
  const payload = {
    documentType: 'DNI',
    documentNumber: seqDocumentNumber(),
    firstName: 'Test',
    lastName: id,
    ...overrides,
  };
  const res = await api.post('/api/v1/students', { data: payload });
  if (!res.ok()) {
    throw new Error(`makeStudent failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  const tenantCtx = api; // share for cleanup — best-effort
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      await tenantCtx.delete(`/api/v1/students/${publicUuid}`);
    },
  };
}

/**
 * Create a guardian link for {@code student.publicUuid}.
 * Returns a handle whose cleanup deletes the link only (the student
 * itself stays).
 *
 * <p>The BE uses "find-or-create" semantics on
 * {@code (documentType, documentNumber)} — sibling students sharing
 * the same guardian end up linked to the same guardian row.</p>
 */
export async function makeGuardianLink(
  api: APIRequestContext,
  studentPublicUuid: string,
  overrides: {
    relationship?: 'FATHER' | 'MOTHER' | 'OTHER';
    fullName?: string;
    email?: string;
    phone?: string;
    documentType?: 'DNI' | 'CE' | 'PASSPORT' | 'OTHER';
    documentNumber?: string;
  } = {},
) {
  const id = seqId('guardian');
  const payload = {
    documentType: 'DNI' as const,
    documentNumber: overrides.documentNumber ?? seqDocumentNumber(),
    firstName: 'Guardian',
    lastName: id,
    relationship: 'FATHER' as const,
    email: `${id}@example.test`,
    ...overrides,
    // Spread last so the explicit `firstName` / `lastName` from
    // overrides actually wins over the defaults above.
  };
  // The DTO requires `firstName`/`lastName` keys explicitly (not
  // `fullName`) — translate the convenience name here.
  if (overrides.fullName && !overrides.documentNumber) {
    const parts = overrides.fullName.split(/\s+/);
    payload.firstName = parts[0] ?? payload.firstName;
    payload.lastName = parts.slice(1).join(' ') || payload.lastName;
  }
  const res = await api.post(`/api/v1/students/${studentPublicUuid}/guardians`, { data: payload });
  if (!res.ok()) {
    throw new Error(`makeGuardianLink failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const guardianPublicUuid: string = body.data.publicUuid;
  return {
    publicUuid: guardianPublicUuid,
    payload,
    cleanup: async () => {
      await api.delete(`/api/v1/students/${studentPublicUuid}/guardians/${guardianPublicUuid}`);
    },
  };
}
