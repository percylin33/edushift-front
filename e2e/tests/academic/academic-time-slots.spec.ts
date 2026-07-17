import { test, expect } from '@playwright/test';
import { TENANT_ADMIN } from '../../fixtures/test-users';
import { apiContextFor } from '../../utils/api-helpers';
import {
  makeAcademicBundle,
  makeCourse,
  makeTeacher,
  makeTeacherAssignment,
} from '../../factories';

/**
 * Academic time-slots — API coverage (Sprint 2.3).
 *
 * <p>Time-slots bind a teacher-assignment to specific weekdays +
 * start/end times. The endpoint nests under teacher-assignments so
 * each slot belongs to a (teacher, course, section, period) tuple.</p>
 */
const SLOTS = (aid: string) => `/api/v1/teacher-assignments/${aid}/time-slots`;
const SLOT = (uuid: string) => `/api/v1/time-slots/${uuid}`;

test.describe('Academic time-slots — API', () => {
  test('create → list → update → delete lifecycle', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const teacher = await makeTeacher(api, {});
    const bundle = await makeAcademicBundle(api);
    const course = await makeCourse(api, { levelPublicUuids: [bundle.level.publicUuid] });
    let assignmentCleanup: (() => Promise<void>) | undefined;
    let slotPublicUuid = '';
    try {
      // Create a teacher-assignment (requires academic period).
      const period = await import('../../factories').then((m) =>
        m.makeAcademicPeriod(api, { academicYearPublicUuid: bundle.year.publicUuid }),
      );

      const assignRes = await api.post(
        `/api/v1/teachers/${teacher.publicUuid}/assignments`,
        {
          data: {
            sectionPublicUuid: bundle.section.publicUuid,
            coursePublicUuid: course.publicUuid,
            academicPeriodPublicUuid: period.publicUuid,
          },
        },
      );
      if (assignRes.status() >= 400) {
        throw new Error(`assignment create failed: ${assignRes.status()} ${await assignRes.text()}`);
      }
      const assignmentPublicUuid = (await assignRes.json()).data.publicUuid;
      assignmentCleanup = async () => {
        await api.delete(`/api/v1/assignments/${assignmentPublicUuid}`).catch(() => undefined);
      };

      // CREATE slot — CreateTimeSlotRequest uses Short dayOfWeek (ISO-8601:
      // 1=Monday..7=Sunday) and LocalTime start/end.
      const create = await api.post(SLOTS(assignmentPublicUuid), {
        data: {
          dayOfWeek: 1,                       // Monday
          startTime: '08:00:00',
          endTime: '09:00:00',
          classroom: 'Aula 101',
        },
      });
      if (create.status() >= 400) {
        throw new Error(`slot create failed: ${create.status()} ${await create.text()}`);
      }
      slotPublicUuid = (await create.json()).data.publicUuid;

      // LIST.
      const list = await api.get(SLOTS(assignmentPublicUuid));
      expect(list.status()).toBe(200);

      // UPDATE.
      const update = await api.put(SLOT(slotPublicUuid), {
        data: { endTime: '10:00' },
      });
      expect(update.status()).toBe(200);

      // DELETE.
      const del = await api.delete(SLOT(slotPublicUuid));
      expect(del.status()).toBe(204);
    } finally {
      await course.cleanup();
      await teacher.cleanup();
      await bundle.cleanup();
      if (assignmentCleanup) await assignmentCleanup();
      await api.dispose();
    }
  });

  test('teacher-schedule endpoint returns teacher schedule', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const teacher = await makeTeacher(api, {});
    try {
      const res = await api.get(`/api/v1/teachers/${teacher.publicUuid}/schedule`);
      expect(res.status()).toBe(200);
      const items = await res.json();
      expect(Array.isArray(items)).toBe(true);
    } finally {
      await teacher.cleanup();
      await api.dispose();
    }
  });

  test('section-schedule endpoint returns section schedule', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    try {
      const res = await api.get(`/api/v1/academic/sections/${bundle.section.publicUuid}/schedule`);
      expect(res.status()).toBe(200);
      const items = await res.json();
      expect(Array.isArray(items)).toBe(true);
    } finally {
      await bundle.cleanup();
      await api.dispose();
    }
  });
});
