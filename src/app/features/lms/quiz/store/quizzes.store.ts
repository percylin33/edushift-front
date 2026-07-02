import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { QuizApiService } from '../services/quiz-api.service';
import {
  CreateQuestionRequest,
  CreateQuizRequest,
  QuizDetail,
  QuizRow,
  QuizStatus,
  QuestionRow,
  UpdateQuizRequest,
} from '../models/quiz.model';

/**
 * Reactive store del feature {@code lms.quizzes} (FE-7b.1).
 *
 * <h3>Slices</h3>
 * <ol>
 *   <li><b>By-section list</b> — la grilla del TEACHER. Mantiene
 *       {@link #_currentSectionUuid} para que cambios de filtro
 *       re-fetcheen sobre la misma sección sin volver a pasar el id.</li>
 *   <li><b>Selected detail</b> — el quiz abierto en detail / form.
 *       Se actualiza en cada lifecycle hop (publish / close / addQuestion
 *       / addOption).</li>
 * </ol>
 *
 * <p>Los dos slices son independientes: cargar el listing de la sección
 * no contamina la selección del detail, y viceversa. Mutaciones (create
 * / update / publish / close / addQuestion / addOption) refrescan tanto
 * el listing (si la sección está abierta) como el detail (si el uuid
 * coincide).</p>
 */
@Injectable({ providedIn: 'root' })
export class QuizzesStore {
  private readonly api = inject(QuizApiService);

  // ---------------------------------------------------------------------------
  // List-by-section slice (TEACHER)
  // ---------------------------------------------------------------------------
  private readonly _rows = signal<QuizRow[]>([]);
  private readonly _filters = signal<{ status?: QuizStatus }>({});
  private readonly _currentSectionUuid = signal<string | null>(null);
  private readonly _loading = signal<boolean>(false);

  // ---------------------------------------------------------------------------
  // Detail slice
  // ---------------------------------------------------------------------------
  private readonly _selected = signal<QuizDetail | null>(null);
  private readonly _loadingDetail = signal<boolean>(false);

  // ---------------------------------------------------------------------------
  // Shared
  // ---------------------------------------------------------------------------
  private readonly _saving = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // ---------------------------------------------------------------------------
  // Public read-only API
  // ---------------------------------------------------------------------------
  readonly rows = this._rows.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly currentSectionUuid = this._currentSectionUuid.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly selected = this._selected.asReadonly();
  readonly loadingDetail = this._loadingDetail.asReadonly();

  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();

  readonly isEmpty = computed(() => !this._loading() && this._rows().length === 0);

  // ---------------------------------------------------------------------------
  // List by section
  // ---------------------------------------------------------------------------

  /**
   * Carga el listing de una sección. Si ya hay un listing activo y los
   * filtros coinciden, no vuelve a fetchear. Si difieren, reemplaza
   * en sitio.
   */
  async loadBySection(sectionUuid: string, filters: { status?: QuizStatus } = {}): Promise<void> {
    const sameSection = this._currentSectionUuid() === sectionUuid;
    const sameFilter = this._filters().status === (filters.status ?? undefined);
    if (sameSection && sameFilter && this._rows().length > 0) return;

    this._currentSectionUuid.set(sectionUuid);
    this._filters.set(filters);
    this._loading.set(true);
    this._error.set(null);
    try {
      const rows = await firstValueFrom(this.api.listBySection(sectionUuid, filters));
      this._rows.set(rows);
    } catch {
      this._rows.set([]);
      this._error.set('No pudimos cargar los quizzes de la sección.');
    } finally {
      this._loading.set(false);
    }
  }

  setStatusFilter(status: QuizStatus | undefined): void {
    const section = this._currentSectionUuid();
    if (!section) return;
    void this.loadBySection(section, { status });
  }

  // ---------------------------------------------------------------------------
  // Detail
  // ---------------------------------------------------------------------------

  async loadDetail(publicUuid: string): Promise<QuizDetail | null> {
    this._loadingDetail.set(true);
    this._error.set(null);
    try {
      const detail = await firstValueFrom(this.api.getQuiz(publicUuid));
      this._selected.set(detail);
      return detail;
    } catch {
      this._selected.set(null);
      this._error.set('No pudimos cargar el quiz. Es posible que haya sido eliminado.');
      return null;
    } finally {
      this._loadingDetail.set(false);
    }
  }

  clearDetail(): void {
    this._selected.set(null);
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  async createQuiz(
    sectionPublicUuid: string,
    request: CreateQuizRequest,
  ): Promise<QuizDetail | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const created = await firstValueFrom(this.api.createQuiz(sectionPublicUuid, request));
      this._selected.set(created);
      this.refreshRowFromDetail(created);
      return created;
    } catch {
      this._error.set('No pudimos crear el quiz. Revisa los datos e inténtalo de nuevo.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async updateQuiz(publicUuid: string, patch: UpdateQuizRequest): Promise<QuizDetail | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const updated = await firstValueFrom(this.api.updateQuiz(publicUuid, patch));
      this._selected.set(updated);
      this.refreshRowFromDetail(updated);
      return updated;
    } catch {
      this._error.set('No pudimos guardar los cambios.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async publishQuiz(publicUuid: string): Promise<QuizDetail | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const published = await firstValueFrom(this.api.publishQuiz(publicUuid));
      this._selected.set(published);
      this.refreshRowFromDetail(published);
      return published;
    } catch {
      this._error.set('No pudimos publicar el quiz. Verifica que tenga al menos una pregunta.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async closeQuiz(publicUuid: string): Promise<QuizDetail | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const closed = await firstValueFrom(this.api.closeQuiz(publicUuid));
      this._selected.set(closed);
      this.refreshRowFromDetail(closed);
      return closed;
    } catch {
      this._error.set('No pudimos cerrar el quiz.');
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async deleteQuiz(publicUuid: string): Promise<boolean> {
    this._saving.set(true);
    this._error.set(null);
    try {
      await firstValueFrom(this.api.deleteQuiz(publicUuid));
      this._rows.update((rows) => rows.filter((r) => r.publicUuid !== publicUuid));
      if (this._selected()?.publicUuid === publicUuid) {
        this._selected.set(null);
      }
      return true;
    } catch {
      this._error.set('No pudimos eliminar el quiz.');
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  /**
   * Añade una pregunta al banco del quiz seleccionado. Refetch del
   * detail para reflejar la nueva posición.
   */
  async addQuestion(
    quizPublicUuid: string,
    request: CreateQuestionRequest,
  ): Promise<QuestionRow | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const question = await firstValueFrom(this.api.addQuestion(quizPublicUuid, request));
      // Refetch detail to update the full question list with positions.
      await this.loadDetail(quizPublicUuid);
      return question;
    } catch {
      this._error.set(
        'No pudimos añadir la pregunta. Revisa el shape (MC: 2-6 options, 1 isCorrect; TF: correctBoolean; SA: expectedKeywords).',
      );
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  clearError(): void {
    this._error.set(null);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * After a mutation, mirror the resulting detail back into whichever
   * listing slices contain a row with the same {@code publicUuid}. If
   * the listing is on a different section the row is left alone
   * (it will be re-fetched when the user navigates to the right one).
   */
  private refreshRowFromDetail(detail: QuizDetail): void {
    this._rows.update((rows) =>
      rows.map((r) =>
        r.publicUuid === detail.publicUuid
          ? {
              ...r,
              title: detail.title,
              status: detail.status,
              dueAt: detail.dueAt,
              timeLimitMinutes: detail.timeLimitMinutes,
              maxAttempts: detail.maxAttempts,
              maxScore: detail.maxScore,
              questionCount: detail.questionCount,
              totalPoints: detail.totalPoints,
            }
          : r,
      ),
    );
  }
}
