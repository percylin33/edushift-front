import { APIRequestContext } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { CreatedEntity, seqId } from './_shared';

/**
 * Generate a unique alphanumeric code of {@code length} characters
 * for entities with {@code ^[A-Za-z0-9_]*$} codes. Used by the
 * academic-level / course / unit factories. {@code length} includes
 * the {@code prefix}.
 */
function uniqCode(prefix: string, length = 8): string {
  const hex = randomBytes(length).toString('hex');
  return (prefix + hex).slice(0, length).toUpperCase();
}

/**
 * Factories for the academic hierarchy:
 * year → level → grade → section → course → unit.
 *
 * Each factory depends on the previous one (e.g. `makeSection` requires
 * a year + grade). The {@link AcademicBundle} wrapper composes the
 * whole chain so specs can grab a complete setup with one call.
 */

export interface AcademicBundle {
  year: CreatedEntity;
  level: CreatedEntity;
  grade: CreatedEntity;
  section: CreatedEntity;
  course: CreatedEntity;
  cleanup: () => Promise<void>;
}

export async function makeAcademicYear(
  api: APIRequestContext,
  overrides: { name?: string; startDate?: string; endDate?: string } = {},
): Promise<CreatedEntity> {
  const id = seqId('yr');
  const year = new Date().getFullYear();
  const payload = {
    name: overrides.name ?? `${id}-${year}`,
    startDate: overrides.startDate ?? `${year}-03-01`,
    endDate: overrides.endDate ?? `${year}-12-15`,
  };
  const res = await api.post('/api/v1/academic/years', { data: payload });
  if (!res.ok()) {
    throw new Error(`makeAcademicYear failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      await api.delete(`/api/v1/academic/years/${publicUuid}`);
    },
  };
}

export async function makeAcademicLevel(
  api: APIRequestContext,
  overrides: { code?: string; name?: string; ordinal?: number } = {},
): Promise<CreatedEntity> {
  const id = seqId('lvl');
  // The BE rejects codes with `-` (regex `^[A-Za-z][A-Za-z0-9_]*$`).
  // Generate an 8-char alphanumeric code via crypto random — guaranteed
  // unique per call, even when multiple workers run in parallel.
  const safeCode = uniqCode('LVL', 8);
  const payload = {
    code: overrides.code ?? safeCode,
    name: overrides.name ?? `Level ${id}`,
    ordinal: overrides.ordinal ?? 1,
  };
  const res = await api.post('/api/v1/academic/levels', { data: payload });
  if (!res.ok()) {
    throw new Error(`makeAcademicLevel failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      await api.delete(`/api/v1/academic/levels/${publicUuid}`);
    },
  };
}

export async function makeGrade(
  api: APIRequestContext,
  args: { levelPublicUuid: string; name?: string; ordinal?: number },
): Promise<CreatedEntity> {
  const id = seqId('gr');
  const payload = {
    name: args.name ?? `Grade ${id}`,
    ordinal: args.ordinal ?? 1,
  };
  const res = await api.post(`/api/v1/academic/levels/${args.levelPublicUuid}/grades`, {
    data: payload,
  });
  if (!res.ok()) {
    throw new Error(`makeGrade failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      await api.delete(`/api/v1/academic/levels/${args.levelPublicUuid}/grades/${publicUuid}`);
    },
  };
}

export async function makeSection(
  api: APIRequestContext,
  args: {
    academicYearPublicUuid: string;
    gradePublicUuid: string;
    name?: string;
    capacity?: number;
    displayOrder?: number;
  },
): Promise<CreatedEntity> {
  const id = seqId('sec');
  const payload = {
    academicYearPublicUuid: args.academicYearPublicUuid,
    gradePublicUuid: args.gradePublicUuid,
    name: args.name ?? `Sec ${id}`,
    capacity: args.capacity ?? 30,
    displayOrder: args.displayOrder ?? 1,
  };
  const res = await api.post('/api/v1/academic/sections', { data: payload });
  if (!res.ok()) {
    throw new Error(`makeSection failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      await api.delete(`/api/v1/academic/sections/${publicUuid}`);
    },
  };
}

export async function makeCourse(
  api: APIRequestContext,
  args: { levelPublicUuids: string[]; code?: string; name?: string; credits?: number; hoursPerWeek?: number },
): Promise<CreatedEntity> {
  const id = seqId('crs');
  const payload = {
    code: args.code ?? uniqCode('CRS', 12),
    name: args.name ?? `Course ${id}`,
    credits: args.credits ?? 3,
    hoursPerWeek: args.hoursPerWeek ?? 4,
    levelPublicUuids: args.levelPublicUuids,
  };
  const res = await api.post('/api/v1/academic/courses', { data: payload });
  if (!res.ok()) {
    throw new Error(`makeCourse failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      await api.delete(`/api/v1/academic/courses/${publicUuid}`);
    },
  };
}

export async function makeUnit(
  api: APIRequestContext,
  args: { coursePublicUuid: string; name?: string; description?: string; ordinal?: number },
): Promise<CreatedEntity> {
  const id = seqId('unit');
  const payload = {
    name: args.name ?? `Unit ${id}`,
    description: args.description ?? 'Auto-generated by factory',
    ordinal: args.ordinal ?? 1,
  };
  const res = await api.post(`/api/v1/academic/courses/${args.coursePublicUuid}/units`, {
    data: payload,
  });
  if (!res.ok()) {
    throw new Error(`makeUnit failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      await api.delete(`/api/v1/academic/units/${publicUuid}`);
    },
  };
}

export async function makeAcademicPeriod(
  api: APIRequestContext,
  args: { academicYearPublicUuid: string; periodType?: 'BIMESTRE' | 'TRIMESTRE' | 'ANUAL'; ordinal?: number; name?: string; startDate?: string; endDate?: string },
): Promise<CreatedEntity> {
  const id = seqId('per');
  const payload = {
    academicYearPublicUuid: args.academicYearPublicUuid,
    periodType: args.periodType ?? 'BIMESTRE',
    ordinal: args.ordinal ?? 1,
    name: args.name,
    startDate: args.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: args.endDate ?? new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10),
  };
  const res = await api.post('/api/v1/academic/periods', { data: payload });
  if (!res.ok()) {
    throw new Error(`makeAcademicPeriod failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      await api.delete(`/api/v1/academic/periods/${publicUuid}`);
    },
  };
}

/**
 * Composes a complete academic hierarchy in dependency order:
 * year → level → grade → section → course.
 *
 * Cleanup runs in reverse order so child rows are removed before
 * parents. Used by every spec that needs a real section (attendance,
 * LMS, evaluations, etc.).
 */
export async function makeAcademicBundle(api: APIRequestContext): Promise<AcademicBundle> {
  const year = await makeAcademicYear(api);
  const level = await makeAcademicLevel(api);
  const grade = await makeGrade(api, { levelPublicUuid: level.publicUuid });
  const section = await makeSection(api, {
    academicYearPublicUuid: year.publicUuid,
    gradePublicUuid: grade.publicUuid,
  });
  const course = await makeCourse(api, { levelPublicUuids: [level.publicUuid] });
  return {
    year,
    level,
    grade,
    section,
    course,
    cleanup: async () => {
      // Reverse order — children first.
      await course.cleanup();
      await section.cleanup();
      await grade.cleanup();
      await level.cleanup();
      await year.cleanup();
    },
  };
}
