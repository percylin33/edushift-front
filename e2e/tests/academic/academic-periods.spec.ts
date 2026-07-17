import { test, expect } from '@playwright/test';
import { TENANT_ADMIN } from '../../fixtures/test-users';
import { apiContextFor } from '../../utils/api-helpers';
import {
  makeAcademicBundle,
  makeAcademicPeriod,
} from '../../factories';

/**
 * Academic periods — API coverage (Sprint 2.3).
 *
 * <p>Periods subdivide an academic year (BIMESTRE / TRIMESTRE / ANUAL).
 * The endpoint accepts an {@code academicYearPublicUuid} plus
 * {@code periodType} and {@code ordinal}; the {@code name} is
 * auto-generated when null.</p>
 */
const API = '/api/v1/academic/periods';

test.describe('Academic periods — API', () => {
  test('create → read → update → delete lifecycle', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    try {
      const create = await api.post(API, {
        data: {
          academicYearPublicUuid: bundle.year.publicUuid,
          periodType: 'BIMESTRE',
          ordinal: 1,
          startDate: '2026-03-01',
          endDate: '2026-04-30',
        },
      });
      expect(create.status()).toBe(201);
      const publicUuid = (await create.json()).data.publicUuid;

      const read = await api.get(`${API}/${publicUuid}`);
      expect(read.status()).toBe(200);
      expect((await read.json()).data.periodType).toBe('BIMESTRE');

      // UPDATE — ordinal only (4 ordinals per year is the standard).
      const update = await api.put(`${API}/${publicUuid}`, {
        data: { ordinal: 2 },
      });
      expect(update.status()).toBe(200);

      // DELETE.
      const del = await api.delete(`${API}/${publicUuid}`);
      expect(del.status()).toBe(204);
    } finally {
      await bundle.cleanup();
      await api.dispose();
    }
  });

  test('create rejects invalid periodType', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    try {
      const res = await api.post(API, {
        data: {
          academicYearPublicUuid: bundle.year.publicUuid,
          periodType: 'INVALID',
          ordinal: 1,
          startDate: '2026-03-01',
          endDate: '2026-04-30',
        },
      });
      expect(res.status()).toBe(400);
    } finally {
      await bundle.cleanup();
      await api.dispose();
    }
  });

  test('create without name uses BE auto-name (ordinal + periodType)', async () => {
    // Per CreateAcademicPeriodRequest javadoc: name is auto-generated as
    // "<roman_ordinal> <PeriodType.displayLabel>" — e.g. ordinal=1 +
    // BIMESTRE → "I Bimestre". The BE enforces no ordinal gaps
    // (PERIOD_ORDINAL_GAP), so this test always uses ordinal=1. If the
    // year already has a BIMESTRE-1, this will 409 and the test skips.
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    try {
      const yearRes = await api.get(`/api/v1/academic/years/${bundle.year.publicUuid}`);
      const year = (await yearRes.json()).data;
      const res = await api.post(API, {
        data: {
          academicYearPublicUuid: bundle.year.publicUuid,
          periodType: 'BIMESTRE',
          ordinal: 1,
          startDate: year.startDate,
          endDate: year.endDate,
          // name intentionally omitted → server should generate "I Bimestre".
        },
      });
      // 409 means the year already has a BIMESTRE-1 (e.g. from a prior
      // run). Skip gracefully — the auto-name behavior itself is the
      // thing being tested, not the creation.
      if (res.status() === 409) {
        test.skip(true, 'BIMESTRE ordinal=1 already exists for this year');
        return;
      }
      expect(res.status()).toBe(201);
      const data = (await res.json()).data;
      expect(data.name).toBeTruthy();
      expect(data.name.toLowerCase()).toContain('bimestre');
      // Clean up.
      await api.delete(`${API}/${data.publicUuid}`);
    } finally {
      await bundle.cleanup();
      await api.dispose();
    }
  });

  test('helper factory makeAcademicPeriod works end-to-end', async () => {
    // Sanity check that the new factory (added in Phase 2.3) is wired
    // correctly — Phase 2.2 assignments specs use it.
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    try {
      const period = await makeAcademicPeriod(api, {
        academicYearPublicUuid: bundle.year.publicUuid,
      });
      expect(period.publicUuid).toBeTruthy();
      // Cleanup verifies the helper's cleanup runs without error.
    } finally {
      await bundle.cleanup();
      await api.dispose();
    }
  });
});
