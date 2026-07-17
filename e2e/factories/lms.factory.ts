import { APIRequestContext } from '@playwright/test';
import { CreatedEntity, seqId } from './_shared';

/**
 * Factories for the LMS module:
 *   - {@link makeTask} — POST /sections/{uuid}/tasks
 *   - {@link makeSubmission} — POST /tasks/{uuid}/submissions
 *   - {@link makeMaterial} — POST /sections/{uuid}/materials (link type)
 *   - {@link makeQuiz} — POST /sections/{uuid}/quizzes
 *   - {@link makeQuizQuestion} — POST /quizzes/{uuid}/questions
 *
 * Used by LMS UI + RBAC + RBAC-matrix specs.
 */

export async function makeTask(
  api: APIRequestContext,
  args: {
    sectionPublicUuid: string;
    title?: string;
    description?: string;
    dueAt?: string;
    maxScore?: number;
  },
): Promise<CreatedEntity> {
  const id = seqId('tsk');
  const payload = {
    title: args.title ?? `Task ${id}`,
    description: args.description ?? 'auto-generated task',
    dueAt: args.dueAt,
    maxScore: args.maxScore ?? 20,
  };
  const res = await api.post(`/api/v1/sections/${args.sectionPublicUuid}/tasks`, {
    data: payload,
  });
  if (!res.ok()) {
    throw new Error(`makeTask failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      await api.delete(`/api/v1/tasks/${publicUuid}`);
    },
  };
}

export async function makeSubmission(
  api: APIRequestContext,
  args: { taskPublicUuid: string; studentPublicUuid: string; content?: string; fileUrl?: string },
): Promise<CreatedEntity> {
  const payload = {
    studentPublicUuid: args.studentPublicUuid,
    content: args.content ?? 'auto-generated submission',
    fileUrl: args.fileUrl,
  };
  const res = await api.post(`/api/v1/tasks/${args.taskPublicUuid}/submissions`, {
    data: payload,
  });
  if (!res.ok()) {
    throw new Error(`makeSubmission failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      // Submissions have no DELETE endpoint — the teacher grades them
      // and the parent task deletion cleans them up. No-op cleanup.
    },
  };
}

export async function makeMaterial(
  api: APIRequestContext,
  args: {
    sectionPublicUuid: string;
    title?: string;
    type?: 'LINK' | 'FILE' | 'VIDEO';
    url?: string;
    description?: string;
  },
): Promise<CreatedEntity> {
  const id = seqId('mat');
  const payload = {
    title: args.title ?? `Material ${id}`,
    type: args.type ?? 'LINK',
    url: args.url ?? `https://example.test/${id}`,
    description: args.description ?? 'auto',
  };
  const res = await api.post(`/api/v1/sections/${args.sectionPublicUuid}/materials`, {
    data: payload,
  });
  if (!res.ok()) {
    throw new Error(`makeMaterial failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      await api.delete(`/api/v1/materials/${publicUuid}`);
    },
  };
}

export async function makeQuiz(
  api: APIRequestContext,
  args: {
    sectionPublicUuid: string;
    title?: string;
    description?: string;
    passingScore?: number;
    timeLimitMinutes?: number;
    maxScore?: number;
    maxAttempts?: number;
  },
): Promise<CreatedEntity> {
  const id = seqId('qz');
  const payload = {
    title: args.title ?? `Quiz ${id}`,
    description: args.description ?? 'auto',
    passingScore: args.passingScore ?? 12,
    timeLimitMinutes: args.timeLimitMinutes ?? 30,
    // CreateQuizRequest requires @NotNull maxAttempts (1..10) and
    // maxScore (0..1000) — see edushift-back/.../quizzes/dto/CreateQuizRequest.java.
    maxScore: args.maxScore ?? 20,
    maxAttempts: args.maxAttempts ?? 1,
  };
  const res = await api.post(`/api/v1/sections/${args.sectionPublicUuid}/quizzes`, {
    data: payload,
  });
  if (!res.ok()) {
    throw new Error(`makeQuiz failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      await api.delete(`/api/v1/quizzes/${publicUuid}`);
    },
  };
}

export async function makeQuizQuestion(
  api: APIRequestContext,
  args: {
    quizPublicUuid: string;
    text?: string;
    type?: 'MC' | 'TF' | 'SHORT_ANSWER';
    options?: { label: string; isCorrect?: boolean }[];
    correctAnswer?: string;
    points?: number;
  },
): Promise<CreatedEntity> {
  const id = seqId('q');
  // CreateQuestionRequest uses `prompt` (not `text`) and
  // QuestionType.MC/TF/SHORT_ANSWER. Each option uses `label`
  // (CreateOptionRequest), not `text` — the BE validates
  // `option.label()` and rejects null/blank with a misleading
  // "prompt cannot be blank" error if `label` is missing.
  const payload = {
    prompt: args.text ?? `Question ${id}?`,
    type: args.type ?? 'MC',
    options: (args.options ?? [
      { label: 'A', isCorrect: true },
      { label: 'B', isCorrect: false },
      { label: 'C', isCorrect: false },
      { label: 'D', isCorrect: false },
    ]).map((o) => ({ label: o.label, isCorrect: o.isCorrect ?? false })),
    correctAnswer: args.correctAnswer,
    points: args.points ?? 1,
  };
  const res = await api.post(`/api/v1/quizzes/${args.quizPublicUuid}/questions`, {
    data: payload,
  });
  if (!res.ok()) {
    throw new Error(`makeQuizQuestion failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      // Questions are deleted with the parent quiz.
    },
  };
}

/**
 * Convenience: a complete quiz ready for a student to attempt.
 * Creates the quiz + one multiple-choice question.
 */
export async function makeReadyQuiz(
  api: APIRequestContext,
  args: { sectionPublicUuid: string; title?: string },
): Promise<{ quiz: CreatedEntity; question: CreatedEntity; cleanup: () => Promise<void> }> {
  const quiz = await makeQuiz(api, args);
  const question = await makeQuizQuestion(api, { quizPublicUuid: quiz.publicUuid });
  return {
    quiz,
    question,
    cleanup: async () => {
      await question.cleanup();
      await quiz.cleanup();
    },
  };
}
