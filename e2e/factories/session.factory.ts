import { APIRequestContext } from '@playwright/test';
import { CreatedEntity, seqId } from './_shared';

/**
 * Factories for the sessions + evaluations module:
 *   - {@link makeLearningSession} — POST /academic/units/{uuid}/sessions
 *   - {@link makeEvaluation} — POST /academic/assignments/{uuid}/evaluations
 *   - {@link makeGradeRecord} — POST /academic/evaluations/{uuid}/grade-records
 *
 * Used by LMS / gradebook / evaluations specs.
 */

export async function makeLearningSession(
  api: APIRequestContext,
  args: { unitPublicUuid: string; name?: string; scheduledAt?: string; durationMinutes?: number },
): Promise<CreatedEntity> {
  const id = seqId('ls');
  const payload = {
    name: args.name ?? `Session ${id}`,
    scheduledAt: args.scheduledAt ?? new Date().toISOString(),
    durationMinutes: args.durationMinutes ?? 60,
  };
  const res = await api.post(`/api/v1/academic/units/${args.unitPublicUuid}/sessions`, {
    data: payload,
  });
  if (!res.ok()) {
    throw new Error(`makeLearningSession failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      await api.delete(`/api/v1/learning-sessions/${publicUuid}`);
    },
  };
}

export async function makeEvaluation(
  api: APIRequestContext,
  args: {
    assignmentPublicUuid: string;
    name?: string;
    weight?: number;
    kind?: 'EXAM' | 'QUIZ' | 'HOMEWORK' | 'PROJECT' | 'PARTICIPATION';
    scale?: 'NUMERIC_0_20' | 'NUMERIC_0_100' | 'LETTER' | 'PASS_FAIL';
    scheduledDate?: string;
    dueDate?: string;
    unitPublicUuid?: string;
    learningSessionPublicUuid?: string;
  },
): Promise<CreatedEntity> {
  const id = seqId('eval');
  const payload = {
    kind: args.kind ?? 'EXAM',
    name: args.name ?? `Eval ${id}`,
    weight: args.weight ?? 10.0,
    scheduledDate: args.scheduledDate ?? new Date().toISOString().slice(0, 10),
    dueDate: args.dueDate,
    scale: args.scale ?? 'NUMERIC_0_20',
    unitPublicUuid: args.unitPublicUuid,
    learningSessionPublicUuid: args.learningSessionPublicUuid,
  };
  const res = await api.post(`/api/v1/academic/assignments/${args.assignmentPublicUuid}/evaluations`, {
    data: payload,
  });
  if (!res.ok()) {
    throw new Error(`makeEvaluation failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      await api.delete(`/api/v1/academic/evaluations/${publicUuid}`);
    },
  };
}

export async function makeGradeRecord(
  api: APIRequestContext,
  args: {
    evaluationPublicUuid: string;
    studentPublicUuid: string;
    score?: number;
    comments?: string;
  },
): Promise<CreatedEntity> {
  const payload = {
    studentPublicUuid: args.studentPublicUuid,
    score: args.score ?? 15.0,
    comments: args.comments ?? 'auto-generated',
  };
  const res = await api.post(
    `/api/v1/academic/evaluations/${args.evaluationPublicUuid}/grade-records`,
    { data: payload },
  );
  if (!res.ok()) {
    throw new Error(`makeGradeRecord failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      await api.delete(`/api/v1/academic/grade-records/${publicUuid}`);
    },
  };
}
