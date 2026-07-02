import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API } from '@core/constants';
import { ApiResponse, SpringPage } from '@core/models';
import { ApiService } from '@core/services';
import {
  AddOptionRequest,
  CreateQuestionRequest,
  CreateQuizRequest,
  QuizDetail,
  QuizResponseRaw,
  QuizRow,
  QuizStatus,
  QuizSummaryRaw,
  QuestionResponseRaw,
  QuestionRow,
  UpdateQuizRequest,
  toQuestionRow,
  toQuizDetail,
  toQuizRow,
} from '../models/quiz.model';

/**
 * HTTP boundary for the {@code lms.quizzes} feature (FE-7b.1 / BE-7b.1).
 *
 * <h3>Endpoint coverage</h3>
 * <ul>
 *   <li>{@link #listBySection}    → {@code GET    /v1/lms/sections/{uuid}/quizzes} (TEACHER)</li>
 *   <li>{@link #getQuiz}          → {@code GET    /v1/lms/quizzes/{uuid}} (TEACHER detail)</li>
 *   <li>{@link #createQuiz}       → {@code POST   /v1/lms/sections/{uuid}/quizzes} (TEACHER)</li>
 *   <li>{@link #updateQuiz}       → {@code PATCH  /v1/lms/quizzes/{uuid}} (DRAFT)</li>
 *   <li>{@link #deleteQuiz}       → {@code DELETE /v1/lms/quizzes/{uuid}} (soft-delete)</li>
 *   <li>{@link #publishQuiz}      → {@code POST   /v1/lms/quizzes/{uuid}/publish}</li>
 *   <li>{@link #closeQuiz}        → {@code POST   /v1/lms/quizzes/{uuid}/close}</li>
 *   <li>{@link #addQuestion}      → {@code POST   /v1/lms/quizzes/{uuid}/questions}</li>
 *   <li>{@link #addOption}        → {@code POST   /v1/lms/questions/{uuid}/options}</li>
 * </ul>
 *
 * <p>Endpoints del player (start, save, submit, grading queue) viven
 * en {@link QuizAttemptApiService} (FE-7b.2); este servicio se mantiene
 * centrado en el CRUD del quiz.</p>
 *
 * <p>El backend devuelve siempre el envelope {@code ApiResponse<T>};
 * los adapters {@code toQuizRow} / {@code toQuizDetail} /
 * {@code toQuestionRow} lo desenvuelven y normalizan
 * {@code null → undefined} antes de llegar al componente.</p>
 */
@Injectable({ providedIn: 'root' })
export class QuizApiService {
  private readonly api = inject(ApiService);

  /**
   * Lista paginada de quizzes de una sección (TEACHER). Acepta filtro
   * opcional {@code ?status} para que la UI pueda server-side filtrar
   * por lifecycle.
   */
  listBySection(
    sectionPublicUuid: string,
    filters: { status?: QuizStatus } = {},
  ): Observable<QuizRow[]> {
    return this.api
      .get<SpringPage<QuizSummaryRaw>>(API.LMS.SECTION_QUIZZES(sectionPublicUuid), {
        status: filters.status,
      })
      .pipe(map((page) => page.content.map(toQuizRow)));
  }

  /** Detail completo (con questions + options). */
  getQuiz(publicUuid: string): Observable<QuizDetail> {
    return this.api
      .get<ApiResponse<QuizResponseRaw>>(API.LMS.QUIZ_BY_UUID(publicUuid))
      .pipe(map((envelope) => toQuizDetail(envelope.data)));
  }

  /**
   * Crea un quiz en lifecycle {@code DRAFT}. Si se pasa {@code questions},
   * se insertan en bulk (BE-7b.1 valida cada uno contra las invariantes
   * del {@code QuestionType}). {@code dueAt} se pasa como ISO-8601.
   */
  createQuiz(sectionPublicUuid: string, request: CreateQuizRequest): Observable<QuizDetail> {
    return this.api
      .post<ApiResponse<QuizResponseRaw>, CreateQuizRequest>(
        API.LMS.SECTION_QUIZZES_CREATE(sectionPublicUuid),
        request,
      )
      .pipe(map((envelope) => toQuizDetail(envelope.data)));
  }

  /**
   * Edita un quiz. El backend rechaza con 409 si el status es CLOSED
   * (o PUBLISHED para campos distintos de {@code dueAt}/{@code maxAttempts}).
   */
  updateQuiz(publicUuid: string, patch: UpdateQuizRequest): Observable<QuizDetail> {
    return this.api
      .patch<ApiResponse<QuizResponseRaw>, UpdateQuizRequest>(API.LMS.QUIZ_PATCH(publicUuid), patch)
      .pipe(map((envelope) => toQuizDetail(envelope.data)));
  }

  /** Soft-delete del quiz. Los attempts quedan huérfanos (D-QUIZ-10). */
  deleteQuiz(publicUuid: string): Observable<void> {
    return this.api.delete<void>(API.LMS.QUIZ_DELETE(publicUuid));
  }

  /**
   * DRAFT → PUBLISHED. El backend rechaza con 409 si no hay al menos
   * una pregunta ({@code noQuestions}).
   */
  publishQuiz(publicUuid: string): Observable<QuizDetail> {
    return this.api
      .post<ApiResponse<QuizResponseRaw>>(API.LMS.QUIZ_PUBLISH(publicUuid))
      .pipe(map((envelope) => toQuizDetail(envelope.data)));
  }

  /**
   * PUBLISHED → CLOSED. Idempotente: si ya está CLOSED retorna 200 con
   * el mismo payload.
   */
  closeQuiz(publicUuid: string): Observable<QuizDetail> {
    return this.api
      .post<ApiResponse<QuizResponseRaw>>(API.LMS.QUIZ_CLOSE(publicUuid))
      .pipe(map((envelope) => toQuizDetail(envelope.data)));
  }

  /**
   * Añade una pregunta al banco. El backend valida el shape según
   * {@code type}: MC exige 2-6 options con exactamente una
   * {@code isCorrect=true}; TF exige {@code correctBoolean} sin
   * options; SHORT_ANSWER admite {@code expectedKeywords} sin
   * options.
   */
  addQuestion(quizPublicUuid: string, request: CreateQuestionRequest): Observable<QuestionRow> {
    return this.api
      .post<ApiResponse<QuestionResponseRaw>, CreateQuestionRequest>(
        API.LMS.QUIZ_ADD_QUESTION(quizPublicUuid),
        request,
      )
      .pipe(map((envelope) => toQuestionRow(envelope.data)));
  }

  /**
   * Añade una opción MC a una pregunta existente. Re-valida
   * "exactly one correct" en el set completo tras el insert. Devuelve
   * la pregunta entera con la nueva option agregada.
   */
  addOption(questionPublicUuid: string, request: AddOptionRequest): Observable<QuestionRow> {
    return this.api
      .post<ApiResponse<QuestionResponseRaw>, AddOptionRequest>(
        API.LMS.QUESTION_ADD_OPTION(questionPublicUuid),
        request,
      )
      .pipe(map((envelope) => toQuestionRow(envelope.data)));
  }
}
