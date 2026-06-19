import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API } from '@core/constants';
import { ApiResponse, SpringPage } from '@core/models';
import { ApiService } from '@core/services';
import {
  AnswerInputRaw,
  AttemptDetail,
  AttemptResponseRaw,
  AttemptSummaryRaw,
  AttemptSummaryRow,
  GradingQueueItem,
  GradingQueueItemRaw,
  ManualGradeAttemptRequest,
  toAttemptDetail,
  toAttemptSummaryRow,
  toGradingQueueItem
} from '../models/attempt.model';

/**
 * REST client for the LMS Quiz attempts + manual grading flow
 * (Sprint 7b / BE-7b.2).
 *
 * <h3>Endpoints consumed</h3>
 * <ul>
 *   <li>{@code POST   /quizzes/{quizUuid}/attempts} → {@link #startAttempt}</li>
 *   <li>{@code GET    /attempts/{attemptUuid}} → {@link #getAttempt}</li>
 *   <li>{@code PATCH  /attempts/{attemptUuid}} → {@link #saveAnswers}</li>
 *   <li>{@code POST   /attempts/{attemptUuid}/submit} → {@link #submitAttempt}</li>
 *   <li>{@code GET    /quizzes/{quizUuid}/attempts} → {@link #listAttempts}</li>
 *   <li>{@code GET    /quizzes/{quizUuid}/grading-queue} → {@link #getGradingQueue}</li>
 *   <li>{@code POST   /attempts/{attemptUuid}/grade} → {@link #gradeAttempt}</li>
 *   <li>{@code PATCH  /quizzes/{quizUuid}/attempts/{attemptUuid}/answers/{answerUuid}} → {@link #overrideAnswerGrade}</li>
 * </ul>
 */
@Injectable({ providedIn: 'root' })
export class AttemptApiService {
  private readonly api = inject(ApiService);

  /**
   * Start a new attempt for the caller on a given quiz.
   * Returns the full {@link AttemptDetail} (status = IN_PROGRESS).
   * Backend may 409 with {@code QUIZ_ATTEMPT_ALREADY_STARTED} if there is an
   * IN_PROGRESS attempt and {@code attemptsAllowed=1}; the caller should then
   * resume the existing one with {@link #getAttempt}.
   */
  startAttempt(quizPublicUuid: string): Observable<AttemptDetail> {
    return this.api
      .post<ApiResponse<AttemptResponseRaw>, Record<string, never>>(
        API.LMS.QUIZ_ATTEMPT_START(quizPublicUuid),
        {}
      )
      .pipe(map((res) => toAttemptDetail(res.data)));
  }

  /** Fetch a single attempt with all its answers. */
  getAttempt(attemptPublicUuid: string): Observable<AttemptDetail> {
    return this.api
      .get<ApiResponse<AttemptResponseRaw>>(API.LMS.QUIZ_ATTEMPT_BY_UUID(attemptPublicUuid))
      .pipe(map((res) => toAttemptDetail(res.data)));
  }

  /**
   * Upsert answers on an IN_PROGRESS attempt. Server validates shape
   * (mutually exclusive payload, question type match).
   */
  saveAnswers(attemptPublicUuid: string, answers: AnswerInputRaw[]): Observable<AttemptDetail> {
    return this.api
      .patch<ApiResponse<AttemptResponseRaw>, { answers: AnswerInputRaw[] }>(
        API.LMS.QUIZ_ATTEMPT_PATCH(attemptPublicUuid),
        { answers }
      )
      .pipe(map((res) => toAttemptDetail(res.data)));
  }

  /**
   * Final submit. Locks the attempt and runs the auto-grader. Returns the
   * updated {@link AttemptDetail} (status ∈ {SUBMITTED, AUTO_GRADED, GRADED}).
   */
  submitAttempt(attemptPublicUuid: string): Observable<AttemptDetail> {
    return this.api
      .post<ApiResponse<AttemptResponseRaw>, Record<string, never>>(
        API.LMS.QUIZ_ATTEMPT_SUBMIT(attemptPublicUuid),
        {}
      )
      .pipe(map((res) => toAttemptDetail(res.data)));
  }

  /** Paginated listing of all attempts for a quiz (TEACHER side). */
  listAttempts(
    quizPublicUuid: string,
    pageable: { page?: number; size?: number; sort?: string } = {}
  ): Observable<SpringPage<AttemptSummaryRow>> {
    return this.api
      .get<SpringPage<AttemptSummaryRaw>>(API.LMS.QUIZ_ATTEMPTS_LIST(quizPublicUuid), {
        page: pageable.page ?? 0,
        size: pageable.size ?? 20,
        sort: pageable.sort
      })
      .pipe(
        map((page) => ({
          ...page,
          content: (page.content ?? []).map(toAttemptSummaryRow)
        }))
      );
  }

  /** Manual grading queue: pending SHORT_ANSWER answers for a quiz. */
  getGradingQueue(quizPublicUuid: string): Observable<GradingQueueItem[]> {
    return this.api
      .get<ApiResponse<GradingQueueItemRaw[]>>(API.LMS.QUIZ_GRADING_QUEUE(quizPublicUuid))
      .pipe(map((res) => (res.data ?? []).map(toGradingQueueItem)));
  }

  /**
   * Apply manual grades to an attempt's pending answers and transition the
   * attempt to GRADED. Returns the full updated {@link AttemptDetail}.
   */
  gradeAttempt(
    attemptPublicUuid: string,
    request: ManualGradeAttemptRequest
  ): Observable<AttemptDetail> {
    return this.api
      .post<ApiResponse<AttemptResponseRaw>, ManualGradeAttemptRequest>(
        API.LMS.QUIZ_ATTEMPT_GRADE(attemptPublicUuid),
        request
      )
      .pipe(map((res) => toAttemptDetail(res.data)));
  }

  /**
   * Single-answer override: change the {@code pointsAwarded} on one answer
   * without re-running the bulk grade. Returns the full updated
   * {@link AttemptDetail} (status = GRADED once all SHORT_ANSWER are covered).
   */
  overrideAnswerGrade(
    quizPublicUuid: string,
    attemptPublicUuid: string,
    answerPublicUuid: string,
    pointsAwarded: number
  ): Observable<AttemptDetail> {
    return this.api
      .patch<
        ApiResponse<AttemptResponseRaw>,
        { answerPublicUuid: string; pointsAwarded: number }
      >(API.LMS.QUIZ_ANSWER_GRADE(quizPublicUuid, attemptPublicUuid, answerPublicUuid), {
        answerPublicUuid,
        pointsAwarded
      })
      .pipe(map((res) => toAttemptDetail(res.data)));
  }
}
