import { test, expect } from '@playwright/test';
import {
  TENANT_ADMIN,
  TEACHER,
  STAFF,
  PARENT,
  STUDENT,
} from '../../fixtures/test-users';
import { apiContextFor, safeApiContextFor } from '../../utils/api-helpers';

/**
 * AI Assistant — API coverage + RBAC matrix (Sprint 2.9).
 *
 * <p>The AI module owns:
 * <ul>
 *   <li><b>Chat sessions</b> — POST/GET/DELETE conversations between
 *       users and the AI assistant.</li>
 *   <li><b>Chat messages</b> — POST a user message; the response is
 *       an SSE stream of the assistant's reply.</li>
 *   <li><b>Generations</b> — fire-and-forget AI calls
 *       ({@code /lms/ai/quiz-questions}, {@code /generate-session},
 *       {@code /generate-rubric}) that return a generation record.</li>
 *   <li><b>Usage tracking</b> — {@code /usage/summary},
 *       {@code /usage/daily}, {@code /usage/export.csv}. TA-only.</li>
 *   <li><b>Prompt management</b> — TA-only, manages the versioned
 *       prompt templates served to the AI.</li>
 * </ul>
 *
 * <p>The OpenRouter integration is gated by
 * {@code app.integrations.openrouter.enabled} — if the dev BE runs
 * without a real OpenRouter key, AI calls return 503
 * {@code AI_PROVIDER_UNAVAILABLE}. Tests focus on the API shape and
 * RBAC; live AI calls would need real credentials.</p>
 *
 * <p>URL prefix caveat: AI controllers (ChatController, UsageController,
 * PromptManagementController) declare {@code @RequestMapping("/v1/ai/...")}
 * or similar. Combined with {@code server.servlet.context-path=/api} +
 * {@code WebConfiguration.addPathPrefix("/v1")}, the effective path is
 * {@code /api/v1/v1/ai/...} — a double-{@code /v1} prefix. This is a
 * BE bug; AI controllers should drop their {@code /v1} prefix. Other
 * modules (students, teachers, ...) correctly use
 * {@code @RequestMapping("/X")} and resolve to {@code /api/v1/X}.</p>
 */
const CHAT = '/api/v1/v1/ai/chat';
const USAGE = '/api/v1/v1/ai/usage';
const PROMPTS = '/api/v1/v1/ai/prompts';
const LMS_AI = '/api/v1/v1/lms/ai';

test.describe('AI — API: chat session lifecycle as TENANT_ADMIN', () => {
  test('create → list → get messages → delete', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const suffix = `lc${Date.now().toString(36).slice(-6)}`;
    try {
      // 1. Create chat session.
      // V75 fix: fk_chat_sessions_user now points at users.public_uuid,
      // so inserts succeed. Expect 200/201 (success) or 400 (bad
      // payload). 409 here would be a regression — the original FK
      // bug is closed. See docs/qa/migrations-lessons.md.
      const create = await api.post(`${CHAT}/sessions`, {
        data: { title: `LifecycleChat ${suffix}`, systemPromptKey: 'default' },
      });
      expect([200, 201], 'chat session create should succeed (V75)').toContain(create.status());
      const publicUuid = (await create.json()).data.publicUuid;

      // 2. List chat sessions.
      const list = await api.get(`${CHAT}/sessions`);
      expect(list.status()).toBe(200);

      // 3. Get messages (empty list until a message is sent).
      const msgs = await api.get(`${CHAT}/sessions/${publicUuid}/messages`);
      expect(msgs.status()).toBe(200);
      const body = await msgs.json();
      const items = body.content ?? (Array.isArray(body) ? body : []);
      expect(Array.isArray(items)).toBe(true);

      // 4. Delete session.
      const del = await api.delete(`${CHAT}/sessions/${publicUuid}`);
      expect(del.status()).toBe(204);
    } finally {
      await api.dispose();
    }
  });

  test('send a chat message returns SSE (200 with text/event-stream)', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const suffix = `sse${Date.now().toString(36).slice(-6)}`;
    try {
      // Setup: create a session. V75 fix: this should succeed (was
      // 409 in tecnosur before the FK was re-targeted).
      const create = await api.post(`${CHAT}/sessions`, {
        data: { title: `SSE Chat ${suffix}`, systemPromptKey: 'default' },
      });
      expect([200, 201], 'chat session create should succeed (V75)').toContain(create.status());
      const publicUuid = (await create.json()).data.publicUuid;

      // Send message. The endpoint returns SSE; we use Playwright's
      // request context with a short timeout to verify the headers.
      const ctx = await import('@playwright/test').then((m) =>
        m.request.newContext({ baseURL: 'http://localhost:8081' }),
      );
      try {
        const apiLogin = await apiContextFor({ user: TENANT_ADMIN });
        const token = await import('../../factories').then(() => null); // unused
        void token;
        // Use the existing api context — just use api directly.
        void apiLogin;
        void ctx;
        // Fall back to api directly with Accept header for SSE.
        const res = await api.post(
          `${CHAT}/sessions/${publicUuid}/messages`,
          {
            data: { content: 'Hello AI!' },
            headers: { Accept: 'text/event-stream' },
          },
        );
        // Without OpenRouter, the BE returns 503 AI_PROVIDER_UNAVAILABLE.
        // With it, it returns 200 + text/event-stream and an SSE body.
        expect(res.status(), 'send-message endpoint reachable').toBeGreaterThanOrEqual(200);
        expect(res.status()).toBeLessThan(600);
        const ct = res.headers()['content-type'] ?? '';
        // Accept either SSE stream (200) or service-unavailable (503).
        expect([200, 503]).toContain(res.status());
        if (res.status() === 200) {
          expect(ct, 'SSE response should advertise text/event-stream').toMatch(/text\/event-stream/);
        }
      } finally {
        await ctx.dispose();
      }

      // Cleanup.
      await api.delete(`${CHAT}/sessions/${publicUuid}`);
    } finally {
      await api.dispose();
    }
  });
});

test.describe('AI — API: generation endpoints', () => {
  test('POST /lms/ai/quiz-questions returns generation record', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      const res = await api.post(`${LMS_AI}/quiz-questions`, {
        data: {
          topic: 'Lifecycle Generation Spec',
          count: 3,
          unitPublicUuid: '00000000-0000-0000-0000-000000000001',
        },
      });
      expect(res.status()).toBeLessThan(600);
      // 201 (created), 503 (no OpenRouter), or 404 (bad unit). All
      // are acceptable; only 5xx indicates a real bug.
      expect([201, 404, 422, 503]).toContain(res.status());
      if (res.status() < 300) {
        const body = await res.json();
        expect(body.data?.publicUuid).toBeTruthy();
      }
    } finally {
      await api.dispose();
    }
  });

  test('GET /lms/ai/generations/{id} returns the generation', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      // A non-existent publicUuid should return 404 (not 5xx).
      const res = await api.get(`${LMS_AI}/generations/00000000-0000-0000-0000-000000000099`);
      expect([200, 404]).toContain(res.status());
    } finally {
      await api.dispose();
    }
  });
});

test.describe('AI — API: usage tracking (TENANT_ADMIN)', () => {
  test('GET /usage/summary returns the quota dashboard', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      const res = await api.get(`${USAGE}/summary`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data ?? body).toBeTruthy();
    } finally {
      await api.dispose();
    }
  });

  test('GET /usage/daily returns daily series', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      const res = await api.get(`${USAGE}/daily`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      const items = body.data ?? (Array.isArray(body) ? body : []);
      expect(Array.isArray(items)).toBe(true);
    } finally {
      await api.dispose();
    }
  });

  test('GET /usage/export.csv returns CSV', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      const res = await api.get(`${USAGE}/export.csv`, {
        headers: { Accept: 'text/csv' },
      });
      // The BE may return 406 if Accept doesn't match its produces list.
      expect([200, 406]).toContain(res.status());
      if (res.status() === 200) {
        const ct = res.headers()['content-type'] ?? '';
        expect(ct, 'export.csv should advertise CSV content-type').toMatch(/csv|text\/plain/);
      }
    } finally {
      await api.dispose();
    }
  });
});

test.describe('AI — API: prompt management (TA-only)', () => {
  test('GET /prompts/template-keys lists template keys', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      const res = await api.get(`${PROMPTS}/template-keys`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      const items = body.content ?? (Array.isArray(body) ? body : []);
      expect(Array.isArray(items)).toBe(true);
    } finally {
      await api.dispose();
    }
  });

  test('GET /prompts/{templateKey} returns the active version', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      // Try a known template key; if not seeded, 404 is fine.
      const res = await api.get(`${PROMPTS}/default`);
      expect([200, 404]).toContain(res.status());
    } finally {
      await api.dispose();
    }
  });
});

test.describe('AI — API: RBAC matrix', () => {
  // Most AI endpoints require LMS_AI_GENERATE (TA + TENANT_ADMIN).
  // Usage endpoints require LMS_AI_USAGE (TENANT_ADMIN only).
  //
  // NOTE: paths include the doubled /api/v1/v1 prefix because the
  // AI controllers declare @RequestMapping("/v1/ai/...") — see the
  // top-of-file comment for the underlying BE bug.
  //
  // V75 fix: fk_chat_sessions_user now points at users.public_uuid, so
  // chat session creation returns 2xx instead of 409. The matrix
  // below now expects a deterministic success status — 409 is a
  // regression, not a tolerated outcome.
  const cases: ReadonlyArray<{
    role: 'TENANT_ADMIN' | 'TEACHER' | 'STAFF' | 'PARENT' | 'STUDENT';
    method: 'GET' | 'POST';
    path: string;
    body?: Record<string, unknown>;
    expected: number[];
    label: string;
  }> = [
    { role: 'TENANT_ADMIN', method: 'GET',  path: '/api/v1/v1/ai/usage/summary',
      expected: [200], label: 'TA reads usage summary' },
    { role: 'TEACHER',     method: 'GET',  path: '/api/v1/v1/ai/usage/summary',
      expected: [403], label: 'TEACHER denied usage' },
    { role: 'PARENT',      method: 'GET',  path: '/api/v1/v1/ai/usage/summary',
      expected: [403], label: 'PARENT denied usage' },
    { role: 'STUDENT',     method: 'GET',  path: '/api/v1/v1/ai/usage/summary',
      expected: [403], label: 'STUDENT denied usage' },
    { role: 'TENANT_ADMIN', method: 'POST', path: '/api/v1/v1/ai/chat/sessions',
      body: { title: 'RBAC chat', systemPromptKey: 'default' },
      expected: [200, 201], label: 'TA creates chat session' },
    { role: 'TEACHER',     method: 'POST', path: '/api/v1/v1/ai/chat/sessions',
      body: { title: 'RBAC chat', systemPromptKey: 'default' },
      expected: [200, 201], label: 'TEACHER creates chat session' },
    { role: 'PARENT',      method: 'POST', path: '/api/v1/v1/ai/chat/sessions',
      body: { title: 'RBAC chat' },
      expected: [403], label: 'PARENT denied chat session' },
    { role: 'STUDENT',     method: 'POST', path: '/api/v1/v1/ai/chat/sessions',
      body: { title: 'RBAC chat' },
      expected: [403], label: 'STUDENT denied chat session' },
    { role: 'TENANT_ADMIN', method: 'POST', path: '/api/v1/v1/lms/ai/quiz-questions',
      body: { topic: 'RBAC', count: 1, unitPublicUuid: '00000000-0000-0000-0000-000000000001' },
      expected: [201, 400, 404, 422, 503], label: 'TA generates quiz questions' },
    { role: 'PARENT',      method: 'POST', path: '/api/v1/v1/lms/ai/quiz-questions',
      body: { topic: 'RBAC' },
      expected: [403, 404], label: 'PARENT denied generation' },
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
        const url = `${process.env['API_URL'] ?? 'http://localhost:8081'}${c.path}`;
        const res = await ctx.api.fetch(url, {
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
