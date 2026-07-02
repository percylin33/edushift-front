import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AttemptApiService } from '../services/attempt-api.service';
import { ApiService } from '@core/services';
import { AttemptsStore } from './attempts.store';
import { AttemptDetail, AttemptResponseRaw, AttemptStatus } from '../models/attempt.model';

describe('AttemptsStore (FE-7b.2)', () => {
  let store: AttemptsStore;
  let api: jasmine.SpyObj<AttemptApiService>;

  const baseRaw: AttemptResponseRaw = {
    publicUuid: 'att-1',
    quizPublicUuid: 'quiz-1',
    studentUserId: 'u-1',
    submitterUserId: 'u-1',
    attemptNumber: 1,
    status: AttemptStatus.InProgress,
    startedAt: '2026-06-12T10:00:00Z',
    submittedAt: null,
    expiresAt: null,
    timeRemainingSeconds: null,
    autoScore: null,
    manualScore: null,
    score: null,
    maxScore: 100,
    gradedByUserId: null,
    gradedAt: null,
    feedback: null,
    revealCorrectness: false,
    answers: [],
    createdAt: '2026-06-12T10:00:00Z',
    updatedAt: '2026-06-12T10:00:00Z',
  };

  const toDetail = (raw: AttemptResponseRaw): AttemptDetail => {
    const d = new Date(raw.startedAt);
    return {
      publicUuid: raw.publicUuid,
      quizPublicUuid: raw.quizPublicUuid,
      studentUserId: raw.studentUserId,
      submitterUserId: raw.submitterUserId,
      attemptNumber: raw.attemptNumber,
      status: raw.status,
      startedAt: d,
      submittedAt: null,
      expiresAt: null,
      timeRemainingSeconds: null,
      autoScore: null,
      manualScore: null,
      score: null,
      maxScore: raw.maxScore ?? null,
      gradedByUserId: null,
      gradedAt: null,
      feedback: null,
      revealCorrectness: false,
      answers: [],
      createdAt: null,
      updatedAt: null,
    };
  };

  beforeEach(() => {
    api = jasmine.createSpyObj<AttemptApiService>('AttemptApiService', [
      'startAttempt',
      'getAttempt',
      'saveAnswers',
      'submitAttempt',
      'listAttempts',
      'getGradingQueue',
      'gradeAttempt',
      'overrideAnswerGrade',
    ]);
    TestBed.configureTestingModule({
      providers: [
        { provide: AttemptApiService, useValue: api },
        { provide: ApiService, useValue: {} },
        AttemptsStore,
      ],
    });
    store = TestBed.inject(AttemptsStore);
  });

  it('startAttempt sets the current and clears the error', async () => {
    api.startAttempt.and.returnValue(of(toDetail(baseRaw)));
    const result = await store.startAttempt('quiz-1');
    expect(result?.publicUuid).toBe('att-1');
    expect(store.current()?.status).toBe(AttemptStatus.InProgress);
    expect(store.error()).toBeNull();
  });

  it('startAttempt captures the error message on failure', async () => {
    api.startAttempt.and.returnValue(throwError(() => ({ error: { message: 'boom' } })));
    const result = await store.startAttempt('quiz-1');
    expect(result).toBeNull();
    expect(store.error()).toBe('boom');
  });

  it('loadAttempt populates current with the detail', async () => {
    api.getAttempt.and.returnValue(of(toDetail({ ...baseRaw, status: AttemptStatus.Graded })));
    const result = await store.loadAttempt('att-1');
    expect(result?.status).toBe(AttemptStatus.Graded);
    expect(store.current()?.status).toBe(AttemptStatus.Graded);
  });

  it('setPendingAnswer queues a payload and exposes hasPending', () => {
    store.setPendingAnswer('q-1', 'MC', {
      questionPublicUuid: 'q-1',
      questionType: 'MC',
      selectedOptionId: 'o-1',
      selectedBoolean: null,
      textAnswer: null,
    });
    expect(store.hasPending()).toBeTrue();
    expect(store.pendingAnswers()['q-1'].selectedOptionId).toBe('o-1');
  });

  it('setPendingAnswer with null removes the entry', () => {
    store.setPendingAnswer('q-1', 'MC', {
      questionPublicUuid: 'q-1',
      questionType: 'MC',
      selectedOptionId: 'o-1',
      selectedBoolean: null,
      textAnswer: null,
    });
    store.setPendingAnswer('q-1', 'MC', null);
    expect(store.hasPending()).toBeFalse();
  });

  it('flushPendingAnswers sends only the pending ones and updates current', async () => {
    api.startAttempt.and.returnValue(of(toDetail(baseRaw)));
    await store.startAttempt('quiz-1');
    store.setPendingAnswer('q-1', 'MC', {
      questionPublicUuid: 'q-1',
      questionType: 'MC',
      selectedOptionId: 'o-1',
      selectedBoolean: null,
      textAnswer: null,
    });
    api.saveAnswers.and.returnValue(of(toDetail({ ...baseRaw, answers: [] })));
    const result = await store.flushPendingAnswers('att-1');
    expect(result).toBeTruthy();
    expect(api.saveAnswers).toHaveBeenCalledOnceWith('att-1', [
      {
        questionPublicUuid: 'q-1',
        questionType: 'MC',
        selectedOptionId: 'o-1',
        selectedBoolean: null,
        textAnswer: null,
      },
    ]);
    expect(store.lastSavedAt()).toBeInstanceOf(Date);
  });

  it('flushPendingAnswers with no pending is a no-op', async () => {
    api.startAttempt.and.returnValue(of(toDetail(baseRaw)));
    await store.startAttempt('quiz-1');
    const result = await store.flushPendingAnswers('att-1');
    expect(result?.publicUuid).toBe('att-1');
    expect(api.saveAnswers).not.toHaveBeenCalled();
  });

  it('flushPendingAnswers captures lastSaveError on failure', async () => {
    api.startAttempt.and.returnValue(of(toDetail(baseRaw)));
    await store.startAttempt('quiz-1');
    store.setPendingAnswer('q-1', 'MC', {
      questionPublicUuid: 'q-1',
      questionType: 'MC',
      selectedOptionId: 'o-1',
      selectedBoolean: null,
      textAnswer: null,
    });
    api.saveAnswers.and.returnValue(throwError(() => ({ error: { message: 'save-fail' } })));
    const result = await store.flushPendingAnswers('att-1');
    expect(result).toBeNull();
    expect(store.lastSaveError()).toBe('save-fail');
  });

  it('submitAttempt transitions current to SUBMITTED and clears pending', async () => {
    api.startAttempt.and.returnValue(of(toDetail(baseRaw)));
    await store.startAttempt('quiz-1');
    store.setPendingAnswer('q-1', 'MC', {
      questionPublicUuid: 'q-1',
      questionType: 'MC',
      selectedOptionId: 'o-1',
      selectedBoolean: null,
      textAnswer: null,
    });
    api.submitAttempt.and.returnValue(
      of(toDetail({ ...baseRaw, status: AttemptStatus.Submitted })),
    );
    const result = await store.submitAttempt('att-1');
    expect(result?.status).toBe(AttemptStatus.Submitted);
    expect(store.hasPending()).toBeFalse();
  });

  it('clearCurrent wipes current + pending + lastSavedAt', async () => {
    api.startAttempt.and.returnValue(of(toDetail(baseRaw)));
    await store.startAttempt('quiz-1');
    store.clearCurrent();
    expect(store.current()).toBeNull();
    expect(store.hasPending()).toBeFalse();
    expect(store.lastSavedAt()).toBeNull();
  });

  it('loadSummaries populates the teacher-side slice', async () => {
    api.listAttempts.and.returnValue(
      of({
        content: [],
        totalElements: 0,
        totalPages: 0,
        size: 20,
        number: 0,
        first: true,
        last: true,
        numberOfElements: 0,
        empty: true,
      }),
    );
    await store.loadSummaries('quiz-1');
    expect(api.listAttempts).toHaveBeenCalledOnceWith('quiz-1', { page: 0, size: 20 });
    expect(store.summariesTotal()).toBe(0);
  });

  it('loadQueue populates the grading queue', async () => {
    api.getGradingQueue.and.returnValue(of([]));
    await store.loadQueue('quiz-1');
    expect(api.getGradingQueue).toHaveBeenCalledOnceWith('quiz-1');
    expect(store.queue()).toEqual([]);
  });

  it('gradeAttempt sends the request and updates current on success', async () => {
    api.gradeAttempt.and.returnValue(of(toDetail({ ...baseRaw, status: AttemptStatus.Graded })));
    const result = await store.gradeAttempt('att-1', {
      grades: [{ answerPublicUuid: 'a-1', pointsAwarded: 5 }],
    });
    expect(result?.status).toBe(AttemptStatus.Graded);
  });

  it('overrideAnswerGrade sends the single-answer PATCH', async () => {
    api.overrideAnswerGrade.and.returnValue(
      of(toDetail({ ...baseRaw, status: AttemptStatus.Graded })),
    );
    const result = await store.overrideAnswerGrade('quiz-1', 'att-1', 'a-1', 3);
    expect(result?.status).toBe(AttemptStatus.Graded);
    expect(api.overrideAnswerGrade).toHaveBeenCalledOnceWith('quiz-1', 'att-1', 'a-1', 3);
  });
});
