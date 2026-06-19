/**
 * AI Assistant domain models (FE-7b.4 — stub).
 *
 * <p>This is the FE-7b.4 stub. The backend {@code LmsAiService} does not exist
 * yet (the {@code modules.ai} package is currently only {@code package-info}
 * and {@code OpenRouterProperties}). The service that consumes these models
 * returns hardcoded suggestions after a small {@code setTimeout} so the UI is
 * fully testable in isolation. When the BE lands, swap the service
 * implementation for a real HTTP call — the shape will stay compatible.</p>
 *
 * <h3>Wire shape (provisional, mirrors the planned LlmGenerationRequest / Response)</h3>
 * <ul>
 *   <li>{@link QuestionSuggestion} — the "raw" payload the LLM would return.
 *       We deliberately keep the prompt + questionType + options + explanation
 *       so the teacher can edit the suggestion before accepting.</li>
 *   <li>{@link AiAssistantRequest} — what the FE sends (topic + count + optional
 *       questionType filter).</li>
 *   <li>{@link AiAssistantStatus} — request lifecycle (idle / loading / success /
 *       error). Mirrors the pattern used in {@code attempts.store} so it slots
 *       in cleanly when the real service is wired up.</li>
 * </ul>
 */

/** Lifecycle of an AI suggestion request. */
export enum AiAssistantStatus {
  Idle = 'IDLE',
  Loading = 'LOADING',
  Success = 'SUCCESS',
  Error = 'ERROR'
}

/** A single MC/TF/SHORT_ANSWER option returned by the LLM. */
export interface AiOptionSuggestion {
  label: string;
  isCorrect: boolean;
  explanation: string | null;
}

/** A single suggested question returned by the assistant. */
export interface QuestionSuggestion {
  /** Local uuid for this suggestion (so the panel can track accept/regen). */
  id: string;
  prompt: string;
  questionType: 'MC' | 'TF' | 'SHORT_ANSWER';
  points: number;
  options: AiOptionSuggestion[];
  /** Why the LLM thinks this is a good question for the topic. */
  rationale: string;
}

/** What the FE sends to the assistant. */
export interface AiAssistantRequest {
  topic: string;
  count: number;
  /** Optional filter — restricts to a single question type. */
  questionType?: 'MC' | 'TF' | 'SHORT_ANSWER';
}

/** The state of an in-flight AI request, used by the panel. */
export interface AiAssistantState {
  status: AiAssistantStatus;
  topic: string;
  suggestions: QuestionSuggestion[];
  error: string | null;
}

/** Initial empty state. */
export function emptyAiState(): AiAssistantState {
  return {
    status: AiAssistantStatus.Idle,
    topic: '',
    suggestions: [],
    error: null
  };
}

/** Adapter from a {@link QuestionSuggestion} to a wire-shape question payload
 * the {@code quiz-api.service} will eventually accept. Kept here (not in
 * {@code quiz.model}) because it depends on the AI-specific fields
 * (rationale, AI option shape). */
export interface CreateAiQuestionRequest {
  prompt: string;
  type: 'MC' | 'TF' | 'SHORT_ANSWER';
  points: number;
  options: Array<{ label: string; isCorrect: boolean; explanation: string | null }>;
  /** Optional explanation the teacher can re-use in the "rationale" UI. */
  aiRationale: string;
}
