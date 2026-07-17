import { APIRequestContext } from '@playwright/test';
import { CreatedEntity, seqId, seqDocumentNumber } from './_shared';

/**
 * Factory: create a teacher via {@code POST /api/v1/teachers}.
 *
 * <p>Used by {@code e2e/tests/teachers/teachers-ui.spec.ts} and any LMS
 * spec that needs a teacher-with-assignment to grade or create a quiz.</p>
 */
export interface TeacherOverrides {
  firstName?: string;
  lastName?: string;
  documentType?: 'DNI' | 'CE' | 'PASSPORT' | 'OTHER';
  documentNumber?: string;
  email?: string;
  phone?: string;
  title?: string;
  specializations?: string[];
  hireDate?: string;
  employmentStatus?: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'TERMINATED';
}

export type CreatedTeacher = CreatedEntity;

/**
 * Create a teacher. The caller passes a TENANT_ADMIN context.
 */
export async function makeTeacher(
  api: APIRequestContext,
  overrides: TeacherOverrides = {},
): Promise<CreatedTeacher> {
  const id = seqId('teacher');
  const payload = {
    documentType: 'DNI',
    documentNumber: seqDocumentNumber(),
    firstName: 'Test',
    lastName: id,
    employmentStatus: 'ACTIVE',
    ...overrides,
  };
  const res = await api.post('/api/v1/teachers', { data: payload });
  if (!res.ok()) {
    throw new Error(`makeTeacher failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      await api.delete(`/api/v1/teachers/${publicUuid}`);
    },
  };
}

/**
 * Wire a teacher to a user account (so they can log in).
 * Returns a handle with no cleanup — the link survives teacher deletion.
 */
export async function makeTeacherUserLink(
  api: APIRequestContext,
  teacherPublicUuid: string,
  userPublicUuid: string,
) {
  const res = await api.post(`/api/v1/teachers/${teacherPublicUuid}/link-user`, {
    data: { userPublicUuid },
  });
  if (!res.ok()) {
    throw new Error(`makeTeacherUserLink failed: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Create a teacher-assignment (teacher ↔ course × section × academic-period).
 * Used by LMS / time-slots / learning-sessions specs that need a teacher
 * authorized for a section.
 *
 * <p>Note the DTO asks for {@code academicPeriodPublicUuid} (a period
 * UUID, not a year UUID) — even though the column-level FK is to the
 * year. The service validates that the period's year equals the
 * section's year.</p>
 */
export async function makeTeacherAssignment(
  api: APIRequestContext,
  args: {
    teacherPublicUuid: string;
    coursePublicUuid: string;
    sectionPublicUuid: string;
    academicPeriodPublicUuid: string;
    weeklyHours?: number;
  },
): Promise<CreatedEntity> {
  const payload = {
    teacherPublicUuid: args.teacherPublicUuid,
    coursePublicUuid: args.coursePublicUuid,
    sectionPublicUuid: args.sectionPublicUuid,
    academicPeriodPublicUuid: args.academicPeriodPublicUuid,
    weeklyHours: args.weeklyHours ?? 4,
  };
  const res = await api.post(`/api/v1/teachers/${args.teacherPublicUuid}/assignments`, {
    data: payload,
  });
  if (!res.ok()) {
    throw new Error(`makeTeacherAssignment failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      await api.delete(`/api/v1/assignments/${publicUuid}`);
    },
  };
}
