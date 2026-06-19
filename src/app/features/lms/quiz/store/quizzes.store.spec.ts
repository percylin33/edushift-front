import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { QuizzesStore } from './quizzes.store';
import { QuizApiService } from '../services/quiz-api.service';
import {
  QuestionType,
  QuizDetail,
  QuizRow,
  QuizStatus
} from '../models/quiz.model';

/**
 * Spec del `QuizzesStore` (FE-7b.1).
 *
 * <p>Cubre:
 * <ol>
 *   <li>loadBySection popula rows + setea currentSectionUuid.</li>
 *   <li>setStatusFilter re-fetchea.</li>
 *   <li>loadDetail popula selected.</li>
 *   <li>Mutaciones (publish / close) reflejan el cambio en rows y
 *       selected simultáneamente.</li>
 *   <li>addQuestion refresca el detail.</li>
 *   <li>Errores setean error + limpian rows/selected.</li>
 * </ol>
 */
describe('QuizzesStore', () => {
  let store: QuizzesStore;
  let apiSpy: jasmine.SpyObj<QuizApiService>;

  function rowOf(overrides: Partial<QuizRow> = {}): QuizRow {
    return {
      publicUuid: 'q-1',
      title: 'Quiz 1',
      status: QuizStatus.Draft,
      dueAt: new Date('2030-01-15T00:00:00.000Z'),
      timeLimitMinutes: 30,
      maxAttempts: 1,
      maxScore: 100,
      ownerPublicUuid: 'tch-1',
      questionCount: 5,
      totalPoints: 50,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides
    };
  }

  function detailOf(overrides: Partial<QuizDetail> = {}): QuizDetail {
    return {
      publicUuid: 'q-1',
      sectionPublicUuid: 's-1',
      title: 'Quiz 1',
      description: null,
      status: QuizStatus.Draft,
      dueAt: new Date('2030-01-15T00:00:00.000Z'),
      timeLimitMinutes: 30,
      maxAttempts: 1,
      maxScore: 100,
      ownerPublicUuid: 'tch-1',
      publishedAt: null,
      closedAt: null,
      questionCount: 5,
      totalPoints: 50,
      revealCorrectness: true,
      questions: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: null,
      ...overrides
    };
  }

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<QuizApiService>('QuizApiService', [
      'listBySection', 'getQuiz', 'createQuiz', 'updateQuiz',
      'publishQuiz', 'closeQuiz', 'deleteQuiz', 'addQuestion', 'addOption'
    ]);
    TestBed.configureTestingModule({
      providers: [
        QuizzesStore,
        { provide: QuizApiService, useValue: apiSpy }
      ]
    });
    store = TestBed.inject(QuizzesStore);
  });

  it('loadBySection popula rows y currentSectionUuid', async () => {
    apiSpy.listBySection.and.returnValue(of([rowOf()]));
    await store.loadBySection('s-1');
    expect(store.rows()).toHaveSize(1);
    expect(store.currentSectionUuid()).toBe('s-1');
    expect(store.loading()).toBeFalse();
  });

  it('setStatusFilter re-fetchea con el nuevo filtro', async () => {
    apiSpy.listBySection.and.returnValue(of([rowOf()]));
    await store.loadBySection('s-1');
    apiSpy.listBySection.calls.reset();
    apiSpy.listBySection.and.returnValue(of([]));
    store.setStatusFilter(QuizStatus.Published);
    await Promise.resolve();
    expect(apiSpy.listBySection).toHaveBeenCalledOnceWith(
      's-1', { status: QuizStatus.Published }
    );
  });

  it('loadDetail popula selected', async () => {
    apiSpy.getQuiz.and.returnValue(of(detailOf()));
    const result = await store.loadDetail('q-1');
    expect(result).toBeTruthy();
    expect(store.selected()?.publicUuid).toBe('q-1');
    expect(store.loadingDetail()).toBeFalse();
  });

  it('loadDetail en error setea error y limpia selected', async () => {
    apiSpy.getQuiz.and.returnValue(throwError(() => new Error('boom')));
    const result = await store.loadDetail('q-1');
    expect(result).toBeNull();
    expect(store.selected()).toBeNull();
    expect(store.error()).toContain('No pudimos cargar el quiz');
  });

  it('publishQuiz muta selected y refleja cambio en rows', async () => {
    apiSpy.listBySection.and.returnValue(of([rowOf({ publicUuid: 'q-1' })]));
    await store.loadBySection('s-1');
    apiSpy.publishQuiz.and.returnValue(of(detailOf({
      status: QuizStatus.Published,
      publishedAt: new Date('2026-06-06T00:00:00.000Z')
    })));
    const updated = await store.publishQuiz('q-1');
    expect(updated?.status).toBe(QuizStatus.Published);
    expect(store.selected()?.status).toBe(QuizStatus.Published);
    expect(store.rows()[0].status).toBe(QuizStatus.Published);
  });

  it('closeQuiz transiciona a CLOSED', async () => {
    apiSpy.listBySection.and.returnValue(of([rowOf()]));
    await store.loadBySection('s-1');
    apiSpy.closeQuiz.and.returnValue(of(detailOf({ status: QuizStatus.Closed })));
    const updated = await store.closeQuiz('q-1');
    expect(updated?.status).toBe(QuizStatus.Closed);
    expect(store.rows()[0].status).toBe(QuizStatus.Closed);
  });

  it('addQuestion refresca el detail (refetch)', async () => {
    const qRow = {
      publicUuid: 'qq-1',
      type: QuestionType.MultipleChoice,
      prompt: 'P',
      points: 5,
      position: 1,
      correctText: null,
      expectedKeywords: null,
      correctBoolean: null,
      options: []
    };
    apiSpy.addQuestion.and.returnValue(of(qRow));
    apiSpy.getQuiz.and.returnValue(of(detailOf({ questionCount: 1, totalPoints: 5 })));
    const result = await store.addQuestion('q-1', {
      type: QuestionType.MultipleChoice,
      prompt: 'P',
      points: 5,
      options: [{ label: 'A', isCorrect: true }, { label: 'B', isCorrect: false }]
    });
    expect(result?.publicUuid).toBe('qq-1');
    expect(apiSpy.getQuiz).toHaveBeenCalled();
    expect(store.selected()?.questionCount).toBe(1);
  });

  it('createQuiz setea selected y agrega al listing si la sección coincide', async () => {
    apiSpy.listBySection.and.returnValue(of([rowOf()]));
    await store.loadBySection('s-1');
    apiSpy.createQuiz.and.returnValue(of(detailOf({ publicUuid: 'q-2' })));
    const created = await store.createQuiz('s-1', { title: 'Nuevo', maxAttempts: 1, maxScore: 50 });
    expect(created?.publicUuid).toBe('q-2');
    expect(store.selected()?.publicUuid).toBe('q-2');
  });

  it('deleteQuiz quita la row del listing y limpia selected si coincide', async () => {
    apiSpy.listBySection.and.returnValue(of([rowOf()]));
    await store.loadBySection('s-1');
    apiSpy.getQuiz.and.returnValue(of(detailOf()));
    await store.loadDetail('q-1');
    apiSpy.deleteQuiz.and.returnValue(of(undefined));
    const ok = await store.deleteQuiz('q-1');
    expect(ok).toBeTrue();
    expect(store.rows()).toEqual([]);
    expect(store.selected()).toBeNull();
  });

  it('updateQuiz persiste cambios en selected + listing', async () => {
    apiSpy.listBySection.and.returnValue(of([rowOf({ title: 'Viejo' })]));
    await store.loadBySection('s-1');
    apiSpy.updateQuiz.and.returnValue(of(detailOf({ title: 'Nuevo título' })));
    const updated = await store.updateQuiz('q-1', { title: 'Nuevo título' });
    expect(updated?.title).toBe('Nuevo título');
    expect(store.rows()[0].title).toBe('Nuevo título');
  });

  it('errores de mutación setean error pero dejan el state anterior intacto', async () => {
    apiSpy.listBySection.and.returnValue(of([rowOf()]));
    await store.loadBySection('s-1');
    apiSpy.publishQuiz.and.returnValue(throwError(() => new Error('boom')));
    const result = await store.publishQuiz('q-1');
    expect(result).toBeNull();
    expect(store.error()).toContain('No pudimos publicar el quiz');
    expect(store.rows()[0].status).toBe(QuizStatus.Draft);
  });

  it('clearError limpia el error', async () => {
    apiSpy.getQuiz.and.returnValue(throwError(() => new Error('boom')));
    await store.loadDetail('q-1');
    expect(store.error()).toBeTruthy();
    store.clearError();
    expect(store.error()).toBeNull();
  });
});
