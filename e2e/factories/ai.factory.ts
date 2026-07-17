import { APIRequestContext } from '@playwright/test';
import { CreatedEntity, seqId } from './_shared';

/**
 * Factories for the AI module:
 *   - {@link makeChatSession} — POST /ai/chat/sessions
 *   - {@link makeGeneration} — captures the result of /ai/generate-*
 *     (the result is returned synchronously by those endpoints, so this
 *     factory is really just a typed wrapper).
 *
 * <p>Used by AI UI + RBAC-matrix specs. SSE streams are tested with
 * {@code utils/stomp-helper.ts} for chat messages and via direct
 * response observation for {@code /generate-*} endpoints.</p>
 */
export async function makeChatSession(
  api: APIRequestContext,
  overrides: { title?: string; systemPromptKey?: string } = {},
): Promise<CreatedEntity> {
  const id = seqId('chat');
  const payload = {
    title: overrides.title ?? `Chat ${id}`,
    systemPromptKey: overrides.systemPromptKey ?? 'default',
  };
  const res = await api.post('/api/v1/ai/chat/sessions', { data: payload });
  if (!res.ok()) {
    throw new Error(`makeChatSession failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      await api.delete(`/api/v1/ai/chat/sessions/${publicUuid}`);
    },
  };
}

export interface AiGeneration {
  publicUuid: string;
  payload: Record<string, unknown>;
  body: unknown;
}

/**
 * Fire-and-forget helper for the synchronous AI generation endpoints
 * ({@code POST /ai/generate-session}, {@code POST /ai/generate-rubric}).
 * Returns the generation record so specs can assert against the body
 * shape; the cleanup is a no-op because generations are kept for audit.
 */
export async function callGeneration(
  api: APIRequestContext,
  args:
    | { kind: 'session'; unitPublicUuid: string; topic: string }
    | { kind: 'rubric'; evaluationPublicUuid: string; criteria: string[] },
): Promise<AiGeneration> {
  const id = seqId('gen');
  let res;
  if (args.kind === 'session') {
    res = await api.post('/api/v1/ai/generate-session', {
      data: { unitPublicUuid: args.unitPublicUuid, topic: args.topic ?? `topic ${id}` },
    });
  } else {
    res = await api.post('/api/v1/ai/generate-rubric', {
      data: { evaluationPublicUuid: args.evaluationPublicUuid, criteria: args.criteria ?? ['clarity'] },
    });
  }
  if (!res.ok()) {
    throw new Error(`callGeneration(${args.kind}) failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return {
    publicUuid: body.data?.publicUuid ?? id,
    payload: { kind: args.kind },
    body: body.data,
  };
}
