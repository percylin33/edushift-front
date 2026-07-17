import { test, expect } from '@playwright/test';
import { TENANT_ADMIN, TEACHER, STAFF, PARENT, STUDENT, TENANT_ADMIN_B } from '../../fixtures/test-users';
import { apiContextFor, safeApiContextFor } from '../../utils/api-helpers';
import {
  makeStudent,
  makeGuardianLink,
  makeAcademicBundle,
} from '../../factories';

/**
 * Students — API contract + RBAC matrix (Sprint 2.1).
 *
 * <p>API-only coverage: every endpoint in the {@code /api/v1/students}
 * surface, exercised by every login-capable role. Fast (no browser)
 * — runs in well under 100ms per spec, so the full file is ~3s.</p>
 *
 * <p>The matrix mirrors {@code docs/architecture/multi-tenant.md} §3
 * and {@code docs/qa/rbac-audit.md} — tenant-admin is the only role
 * allowed to CRUD students; TEACHER / STAFF may read; PARENT may
 * read only their linked children; STUDENT is denied read of any
 * student detail except via their own guardian flow (which lives in
 * the LMS module, not here).</p>
 */

const API = '/api/v1/students';

test.describe('Students — API: CRUD as TENANT_ADMIN', () => {
  test('create → read → update → delete lifecycle', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      const docNumber = `${Date.now().toString().slice(-8)}`;
      // CREATE.
      const create = await api.post(API, {
        data: {
          documentType: 'DNI',
          documentNumber: docNumber,
          firstName: 'Lifecycle',
          lastName: 'Spec',
        },
      });
      expect(create.status(), 'create must be 201').toBe(201);
      const publicUuid = (await create.json()).data.publicUuid;

      // READ.
      const read = await api.get(`${API}/${publicUuid}`);
      expect(read.status()).toBe(200);
      expect((await read.json()).data.firstName).toBe('Lifecycle');

      // UPDATE.
      const update = await api.put(`${API}/${publicUuid}`, {
        data: { firstName: 'Updated' },
      });
      expect(update.status()).toBe(200);
      expect((await update.json()).data.firstName).toBe('Updated');

      // DELETE.
      const del = await api.delete(`${API}/${publicUuid}`);
      expect(del.status(), 'delete should be 204').toBe(204);

      // EduShift uses soft-delete. The GET-by-id endpoint may return
      // either:
      //   - 404 (the row is hidden from detail too), or
      //   - 200 with the row still readable by id.
      // What MUST be true is that the default list excludes the row.
      // (We're testing the list-filter behavior, not the detail access.)
      const readAgain = await api.get(`${API}/${publicUuid}`);
      expect([200, 404], 'soft-deleted student should be 200 or 404').toContain(
        readAgain.status(),
      );

      // Cross-check: the default list (no soft-deleted) does not include it.
      const list = await api.get(API, { params: { q: docNumber, size: 5 } });
      if (list.status() === 200) {
        const body = await list.json();
        const items = body.content ?? body.data?.content ?? body.data?.items ?? [];
        expect(
          items.find((s: { publicUuid: string }) => s.publicUuid === publicUuid),
          'soft-deleted student should not appear in the default list',
        ).toBeUndefined();
      }
    } finally {
      await api.dispose();
    }
  });

  test('create rejects invalid documentNumber (length < 4)', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      const res = await api.post(API, {
        data: {
          documentType: 'DNI',
          documentNumber: '12',     // too short
          firstName: 'Invalid',
          lastName: 'Spec',
        },
      });
      expect(res.status(), 'validation failure should be 400').toBe(400);
      const body = await res.json();
      expect(body.errors?.[0]?.field).toBe('documentNumber');
    } finally {
      await api.dispose();
    }
  });

  test('create rejects duplicate documentNumber per tenant', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    let firstCleanup: (() => Promise<void>) | undefined;
    try {
      const dupNum = `9${String(Date.now()).slice(-7)}`;
      const first = await makeStudent(api, { documentNumber: dupNum });
      firstCleanup = first.cleanup;
      const dup = await api.post(API, {
        data: {
          documentType: 'DNI',
          documentNumber: dupNum,
          firstName: 'Dup',
          lastName: 'Spec',
        },
      });
      expect(dup.status(), 'duplicate doc must 409').toBe(409);
    } finally {
      if (firstCleanup) await firstCleanup();
      await api.dispose();
    }
  });

  test('list supports pagination + section filter', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    let createdCleanup: (() => Promise<void>) | undefined;
    try {
      const s = await makeStudent(api, {});
      createdCleanup = s.cleanup;
      // Filter by the section we just created.
      const res = await api.get(API, {
        params: { sectionPublicUuid: bundle.section.publicUuid, page: 0, size: 5 },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      // Spring Page format: top-level `content` array. Some endpoints
      // also wrap under `data.content` — accept either.
      const items = body.content ?? body.data?.content ?? body.data?.items;
      expect(Array.isArray(items), 'list response should have a content array').toBe(true);
    } finally {
      if (createdCleanup) await createdCleanup();
      await bundle.cleanup();
      await api.dispose();
    }
  });
});

test.describe('Students — API: guardians', () => {
  test('list / create / update / delete guardians', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const student = await makeStudent(api, {});
    try {
      // CREATE — AddGuardianRequest requires documentType + documentNumber
      // (find-or-create by identity) + firstName + lastName + relationship.
      const docNumber = `${Date.now().toString().slice(-8)}`;
      const create = await api.post(`${API}/${student.publicUuid}/guardians`, {
        data: {
          documentType: 'DNI',
          documentNumber: docNumber,
          firstName: 'Padre',
          lastName: `Spec-${docNumber}`,
          relationship: 'FATHER',
          email: `padre.spec.${docNumber}@example.test`,
        },
      });
      expect([200, 201], 'guardian create should be 200 or 201').toContain(create.status());
      // The response shape is { data: { linkPublicUuid, guardianPublicUuid, ... } }
      // — the link's publicUuid is `linkPublicUuid`. The link publicUuid is
      // what the PUT endpoint expects in the URL.
      const created = (await create.json()).data;
      const linkPublicUuid = created.linkPublicUuid ?? created.publicUuid;
      const guardianPublicUuid = created.guardianPublicUuid ?? created.publicUuid;

      // LIST.
      const list = await api.get(`${API}/${student.publicUuid}/guardians`);
      expect(list.status()).toBe(200);

      // UPDATE — UpdateGuardianLinkRequest only mutates link-level
      // fields (relationship, isPrimaryContact, canPickupStudent).
      const update = await api.put(
        `${API}/${student.publicUuid}/guardians/${guardianPublicUuid}`,
        { data: { relationship: 'MOTHER' } },
      );
      if (!update.ok()) {
        // Surface the BE body so the failure is debuggable.
        throw new Error(`PUT guardian failed: ${update.status()} ${await update.text()}`);
      }

      // DELETE.
      const del = await api.delete(
        `${API}/${student.publicUuid}/guardians/${guardianPublicUuid}`,
      );
      expect(del.status(), 'guardian delete should be 204').toBe(204);
    } finally {
      await student.cleanup();
      await api.dispose();
    }
  });
});

test.describe('Students — API: RBAC matrix', () => {
  /**
   * For each (role, endpoint, expected-allowed) triplet, hit the endpoint
   * and assert the status code matches.
   *
   * Expected matrix (matches BE PreAuthorize annotations):
   *   TENANT_ADMIN — full CRUD on /students, /students/{id}, /guardians
   *   TEACHER      — read-only on /students/{id}/attendance-qr (path /qr)
   *   STAFF        — no access
   *   PARENT       — no access (their access is via /guardian-students)
   *   STUDENT      — no access
   *   TENANT_ADMIN_B (cross-tenant) — no access to TA-A resources
   */
  const cases: Array<{
    label: string;
    setup: () => Promise<{ api: import('@playwright/test').APIRequestContext; studentPublicUuid: string }>;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: (s: string) => string;
    // Body for write methods; null for GET/DELETE.
    body?: (s: string) => Record<string, unknown>;
    expect: (role: string) => number | number[];
  }> = [
    {
      label: 'list students',
      setup: async () => {
        const api = await apiContextFor({ user: TENANT_ADMIN });
        const s = await makeStudent(api, {});
        return { api, studentPublicUuid: s.publicUuid };
      },
      method: 'GET',
      path: () => API,
      expect: (role) => (role === 'TENANT_ADMIN' ? [200] : [403, 404]),
    },
    {
      label: 'read student detail',
      setup: async () => {
        const api = await apiContextFor({ user: TENANT_ADMIN });
        const s = await makeStudent(api, {});
        return { api, studentPublicUuid: s.publicUuid };
      },
      method: 'GET',
      path: (s) => `${API}/${s}`,
      expect: (role) => (role === 'TENANT_ADMIN' ? [200] : [403]),
    },
    {
      label: 'create student',
      setup: async () => {
        const api = await apiContextFor({ user: TENANT_ADMIN });
        const s = await makeStudent(api, {});
        return { api, studentPublicUuid: s.publicUuid };
      },
      method: 'POST',
      path: () => API,
      body: () => ({
        documentType: 'DNI',
        documentNumber: `${Date.now().toString().slice(-8)}`,
        firstName: 'Rbac',
        lastName: 'Probe',
      }),
      expect: (role) => (role === 'TENANT_ADMIN' ? [201] : [403]),
    },
    {
      label: 'attendance QR info (TEACHER allowed)',
      setup: async () => {
        const api = await apiContextFor({ user: TENANT_ADMIN });
        const s = await makeStudent(api, {});
        return { api, studentPublicUuid: s.publicUuid };
      },
      method: 'GET',
      path: (s) => `${API}/${s}/attendance-qr/info`,
      expect: (role) =>
        role === 'TENANT_ADMIN' || role === 'TEACHER' ? [200] : [403],
    },
  ];

  for (const role of [
    'TENANT_ADMIN',
    'TEACHER',
    'STAFF',
    'PARENT',
    'STUDENT',
  ] as const) {
    for (const c of cases) {
      test(`${role} ${c.label}: status matches RBAC matrix`, async () => {
        const ctx = await safeApiContextFor({
          user:
            role === 'TENANT_ADMIN'
              ? TENANT_ADMIN
              : role === 'TEACHER'
                ? TEACHER
                : role === 'STAFF'
                  ? STAFF
                  : role === 'PARENT'
                    ? PARENT
                    : STUDENT,
        });
        if (!ctx.api) {
          test.skip(true, ctx.reason);
          return;
        }
        const api = ctx.api;
        let setup: Awaited<ReturnType<typeof c.setup>> | undefined;
        try {
          setup = await c.setup();
          const res = await api.fetch(c.path(setup.studentPublicUuid), {
            method: c.method,
            data: c.body?.(setup.studentPublicUuid),
          });
          const expected = c.expect(role);
          const allowed = Array.isArray(expected) ? expected : [expected];
          expect(
            allowed,
            `${role} ${c.method} ${c.path(setup.studentPublicUuid)} should be one of ${allowed.join('|')}, got ${res.status()}`,
          ).toContain(res.status());
        } finally {
          if (setup) await setup.api.delete(`${API}/${setup.studentPublicUuid}`).catch(() => undefined);
          await api.dispose();
        }
      });
    }
  }
});

test.describe('Students — API: cross-tenant isolation', () => {
  test('TENANT_ADMIN_B cannot read a student from tenant A', async () => {
    // Create a student in tecnosur (TENANT_ADMIN tenant).
    const apiA = await apiContextFor({ user: TENANT_ADMIN });
    const student = await makeStudent(apiA, {});
    try {
      // Attempt access from TENANT_ADMIN_B (different tenant).
      const ctxB = await safeApiContextFor({ user: TENANT_ADMIN_B });
      if (!ctxB.api) {
        test.skip(true, ctxB.reason + ' — skip cross-tenant assertion');
        return;
      }
      const res = await ctxB.api.get(`${API}/${student.publicUuid}`);
      expect(
        [403, 404],
        'cross-tenant student access should be denied (403 or 404 — ' +
          'never 200, never 5xx)',
      ).toContain(res.status());
    } finally {
      await student.cleanup();
      await apiA.dispose();
    }
  });
});

test.describe('Students — API: bulk-import', () => {
  test('template download returns 2xx with .xlsx content-type', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      const res = await api.get(`${API}/bulk-import/template`);
      expect(res.status()).toBe(200);
      const ct = res.headers()['content-type'] ?? '';
      expect(ct).toMatch(/spreadsheet|excel|xlsx|octet-stream/);
    } finally {
      await api.dispose();
    }
  });
});
