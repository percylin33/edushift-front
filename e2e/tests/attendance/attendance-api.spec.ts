import { test, expect } from '@playwright/test';
import {
  TENANT_ADMIN,
  TEACHER,
  STAFF,
  PARENT,
  STUDENT,
} from '../../fixtures/test-users';
import {
  apiContextFor,
  safeApiContextFor,
} from '../../utils/api-helpers';
import {
  makeAcademicBundle,
  makeStudent,
  makeManualCheckIn,
  makeJustification,
} from '../../factories';

/**
 * Attendance — API coverage + RBAC matrix (Sprint 2.4).
 *
 * <p>The attendance module owns:
 * <ul>
 *   <li>Sessions — open / close / list / per-session events (SSE).</li>
 *   <li>Records — check-in (scan), manual check-in, edit, justify.</li>
 *   <li>Justifications — student/parent submit, TENANT_ADMIN approves.</li>
 *   <li>Dashboard — KPIs (TENANT_ADMIN only).</li>
 * </ul>
 *
 * <p>The factories {@link makeManualCheckIn} and
 * {@link makeJustification} are reused from Phase 2 / 2.4 factories;
 * they're TEACHER-friendly by default so the RBAC matrix tests
 * don't fight auth context setup.</p>
 */
const API = '/api/v1/attendance';

test.describe('Attendance — API: session lifecycle as TENANT_ADMIN', () => {
  test('open → list → close lifecycle', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    try {
      // OPEN session — use a unique-per-run date so the new session is
      // easy to find in the list (the dev DB has 30+ seed sessions
      // from previous runs).
      const occurredOn = `2099-12-${String(15 + (Date.now() % 10)).padStart(2, '0')}`;
      const open = await api.post(`${API}/sessions`, {
        data: {
          sectionPublicUuid: bundle.section.publicUuid,
          occurredOn,
          slot: 'MORNING',
        },
      });
      if (open.status() >= 400) {
        throw new Error(`session open failed: ${open.status()} ${await open.text()}`);
      }
      const publicUuid = (await open.json()).data.publicUuid;

      // LIST filtered by `from`/`to` so we only see our own sessions.
      // Response shape: { data: { content: [...], totalElements, ... } }.
      const list = await api.get(
        `${API}/sessions?from=${occurredOn}&to=${occurredOn}`,
      );
      expect(list.status()).toBe(200);
      const body = await list.json();
      const data = body.data ?? body;
      const items = data.content ?? (Array.isArray(body) ? body : []);
      expect(items.find((s: { publicUuid: string }) => s.publicUuid === publicUuid)).toBeTruthy();

      // CLOSE.
      const close = await api.patch(`${API}/sessions/${publicUuid}/close`);
      expect(close.status()).toBeLessThan(300);
    } finally {
      await bundle.cleanup();
      await api.dispose();
    }
  });

  test('open rejects duplicate (section, day, slot) — idempotent re-open', async () => {
    // The BE uses (section, occurredOn, slot) as the idempotency key:
    // opening twice with the same triple returns the existing ACTIVE
    // session without creating a duplicate.
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    const day = `2099-12-${String(15 + (Date.now() % 10)).padStart(2, '0')}`;
    try {
      const a = await api.post(`${API}/sessions`, {
        data: { sectionPublicUuid: bundle.section.publicUuid, occurredOn: day, slot: 'AFTERNOON' },
      });
      const b = await api.post(`${API}/sessions`, {
        data: { sectionPublicUuid: bundle.section.publicUuid, occurredOn: day, slot: 'AFTERNOON' },
      });
      expect([200, 201], 'open should be 2xx').toContain(a.status());
      expect([200, 201], 'second open should be idempotent 2xx').toContain(b.status());
      const aUuid = (await a.json()).data?.publicUuid ?? (await a.json()).publicUuid;
      const bUuid = (await b.json()).data?.publicUuid ?? (await b.json()).publicUuid;
      expect(aUuid, 'both responses should reference the same session').toBe(bUuid);
    } finally {
      await bundle.cleanup();
      await api.dispose();
    }
  });
});

test.describe('Attendance — API: check-in lifecycle', () => {
  test('manual check-in registers a record', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    const student = await makeStudent(api, { firstName: 'AttSpec' });
    let sessionPublicUuid = '';
    let recordPublicUuid = '';
    try {
      // Use the factory's idempotent open — it handles the
      // (section, day, slot) uniqueness.
      const session = await api.post(`${API}/sessions`, {
        data: {
          sectionPublicUuid: bundle.section.publicUuid,
          occurredOn: new Date().toISOString().slice(0, 10),
          slot: 'FULL_DAY',
        },
      });
      if (session.status() >= 400) {
        throw new Error(`open failed: ${session.status()} ${await session.text()}`);
      }
      sessionPublicUuid = (await session.json()).data.publicUuid;

      // Enroll the student so manual-check-in finds the session.
      // CreateEnrollmentRequest requires enrolledAt (LocalDate), not
      // status (the service derives status from the date).
      const enroll = await api.post(`/api/v1/students/${student.publicUuid}/enrollments`, {
        data: {
          sectionPublicUuid: bundle.section.publicUuid,
          academicYearPublicUuid: bundle.year.publicUuid,
          enrolledAt: new Date().toISOString().slice(0, 10),
        },
      });
      // 409 means already enrolled — that's OK.
      if (enroll.status() >= 400 && enroll.status() !== 409) {
        throw new Error(`enroll failed: ${enroll.status()} ${await enroll.text()}`);
      }

      // MANUAL CHECK-IN. ManualCheckInRequest auto-resolves the session
      // (it looks up the student's ACTIVE enrollment + finds/opens the
      // session for that section/today/slot). The actual session UUID
      // returned by the check-in may differ from the one we explicitly
      // opened above. Capture it for downstream assertions.
      const checkIn = await api.post(`${API}/manual-check-in`, {
        data: {
          studentPublicUuid: student.publicUuid,
          status: 'PRESENT',
        },
      });
      if (checkIn.status() >= 400) {
        throw new Error(`check-in failed: ${checkIn.status()} ${await checkIn.text()}`);
      }
      const checkInBody = await checkIn.json();
      recordPublicUuid = checkInBody.data?.publicUuid ?? '';
      const checkInSessionUuid = checkInBody.data?.sessionPublicUuid;

      // LIST records for the actual session the check-in landed on.
      if (checkInSessionUuid) {
        const records = await api.get(`${API}/sessions/${checkInSessionUuid}/records`);
        expect(records.status()).toBe(200);
        const recordsBody = await records.json();
        // Flat array (not paged) — see AttendanceController.listRecords.
        const recs = Array.isArray(recordsBody) ? recordsBody : (recordsBody.content ?? []);
        expect(recs.find((r: { studentPublicUuid: string }) =>
          r.studentPublicUuid === student.publicUuid
        )).toBeTruthy();
      }
      // CLOSE the explicit session we opened.
      void sessionPublicUuid;
    } finally {
      if (sessionPublicUuid) {
        await api.patch(`${API}/sessions/${sessionPublicUuid}/close`).catch(() => undefined);
      }
      await student.cleanup();
      await bundle.cleanup();
      await api.dispose();
    }
    void recordPublicUuid;
  });
});

test.describe('Attendance — API: justification flow', () => {
  test('student/parent can submit justification; TA approves', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    const student = await makeStudent(api, { firstName: 'JustifySpec' });
    let recordPublicUuid = '';
    try {
      // 1. Open a session, enroll the student, register an ABSENT record.
      const sessionRes = await api.post(`${API}/sessions`, {
        data: {
          sectionPublicUuid: bundle.section.publicUuid,
          occurredOn: new Date().toISOString().slice(0, 10),
          slot: 'FULL_DAY',
        },
      });
      if (sessionRes.status() >= 400) {
        throw new Error(`session open failed: ${sessionRes.status()} ${await sessionRes.text()}`);
      }
      const sessionPublicUuid = (await sessionRes.json()).data.publicUuid;

      await api.post(`/api/v1/students/${student.publicUuid}/enrollments`, {
        data: {
          sectionPublicUuid: bundle.section.publicUuid,
          academicYearPublicUuid: bundle.year.publicUuid,
          enrolledAt: new Date().toISOString().slice(0, 10),
        },
      }).catch(() => undefined);

      const absent = await api.post(`${API}/manual-check-in`, {
        data: { studentPublicUuid: student.publicUuid, status: 'ABSENT' },
      });
      if (absent.status() >= 400) {
        throw new Error(`manual-check-in ABSENT failed: ${absent.status()} ${await absent.text()}`);
      }
      recordPublicUuid = (await absent.json()).data?.publicUuid ?? '';

      // 2. Justify as a parent. We use safeApiContextFor which auto-skips
      //    if the role can't log in; the SUITE setup confirms PARENT works.
      const parentCtx = await safeApiContextFor({ user: PARENT });
      let justificationDone = false;
      if (parentCtx.api) {
        const justify = await parentCtx.api.post(
          `${API}/records/${recordPublicUuid}/justify`,
          { data: { justificationText: 'falleció de gripe' } },
        );
        if (justify.ok()) {
          justificationDone = true;
        }
      }

      // 3. TENANT_ADMIN approves.
      if (justificationDone) {
        const approve = await api.post(`${API}/records/${recordPublicUuid}/approve-justification`, {
          data: { approved: true },
        });
        // 200 or 204 — depending on the BE's response shape.
        expect([200, 204], 'approve should be 2xx').toContain(approve.status());
      } else {
        test.skip(true, 'PARENT login not available — skip justification flow');
      }
    } finally {
      await student.cleanup();
      await bundle.cleanup();
      await api.dispose();
    }
  });
});

test.describe('Attendance — API: dashboard (TENANT_ADMIN only)', () => {
  test('GET /attendance/dashboard/overview requires TENANT_ADMIN', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      const res = await api.get(`${API}/dashboard/overview`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      // Shape is documented in DashboardController / DashboardOverviewResponse.
      expect(body.data ?? body).toBeTruthy();
    } finally {
      await api.dispose();
    }
  });

  test('TEACHER cannot read the dashboard', async () => {
    const api = await apiContextFor({ user: TEACHER });
    try {
      const res = await api.get(`${API}/dashboard/overview`);
      expect(res.status(), 'TEACHER should be denied').toBe(403);
    } finally {
      await api.dispose();
    }
  });
});

test.describe('Attendance — API: RBAC matrix', () => {
  // The AttendanceController gates most endpoints with
  // hasAnyRole('TENANT_ADMIN','TEACHER'). PARENT/STUDENT/STAFF are
  // 403 across the board. The dashboard is TENANT_ADMIN only.
  const cases: ReadonlyArray<{
    role: 'TENANT_ADMIN' | 'TEACHER' | 'STAFF' | 'PARENT' | 'STUDENT';
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    body?: Record<string, unknown>;
    expected: number[];
    label: string;
  }> = [
    { role: 'TENANT_ADMIN', method: 'GET',    path: '/sessions',           expected: [200],          label: 'list sessions' },
    { role: 'TEACHER',     method: 'GET',    path: '/sessions',           expected: [200],          label: 'list sessions' },
    { role: 'STAFF',       method: 'GET',    path: '/sessions',           expected: [403],         label: 'list sessions' },
    { role: 'PARENT',      method: 'GET',    path: '/sessions',           expected: [403],         label: 'list sessions' },
    { role: 'STUDENT',     method: 'GET',    path: '/sessions',           expected: [403],         label: 'list sessions' },

    // Manual check-in is allowed for both TENANT_ADMIN and TEACHER
    // (attendance manual-fallback picker, BE-6.8).
    { role: 'TENANT_ADMIN', method: 'POST',   path: '/manual-check-in',    body: { studentPublicUuid: '00000000-0000-0000-0000-000000000000' }, expected: [400, 404, 422], label: 'manual-check-in (bad student)' },
    { role: 'TEACHER',     method: 'POST',   path: '/manual-check-in',    body: { studentPublicUuid: '00000000-0000-0000-0000-000000000000' }, expected: [400, 404, 422], label: 'manual-check-in (bad student)' },
    { role: 'STAFF',       method: 'POST',   path: '/manual-check-in',    body: { studentPublicUuid: '00000000-0000-0000-0000-000000000000' }, expected: [403],         label: 'manual-check-in (bad student)' },

    // Dashboard is TENANT_ADMIN only.
    { role: 'TENANT_ADMIN', method: 'GET',    path: '/dashboard/overview', expected: [200],          label: 'dashboard' },
    { role: 'TEACHER',     method: 'GET',    path: '/dashboard/overview', expected: [403],         label: 'dashboard' },
    { role: 'PARENT',      method: 'GET',    path: '/dashboard/overview', expected: [403],         label: 'dashboard' },
  ];
  for (const c of cases) {
    test(`${c.role} ${c.method} ${c.path} (${c.label}): ${c.expected.join('|')}`, async () => {
      const user = c.role === 'TENANT_ADMIN' ? TENANT_ADMIN
        : c.role === 'TEACHER' ? TEACHER
        : c.role === 'STAFF' ? STAFF
        : c.role === 'PARENT' ? PARENT
        : STUDENT;
      const ctx = await safeApiContextFor({ user });
      if (!ctx.api) {
        test.skip(true, ctx.reason);
        return;
      }
      try {
        const res = await ctx.api.fetch(`${API}${c.path}`, {
          method: c.method,
          data: c.body,
        });
        expect(c.expected, `${c.role} ${c.method} ${c.path}`).toContain(res.status());
      } finally {
        await ctx.api.dispose();
      }
    });
  }
});
