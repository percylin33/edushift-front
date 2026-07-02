import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, computed } from '@angular/core';
import { provideRouter } from '@angular/router';
import { QuizTakePageComponent } from './quiz-take.page';
import { QuizzesStore } from '../../store/quizzes.store';
import { AttemptsStore } from '../../store/attempts.store';
import { QuizStatus, QuestionType, QuizDetail } from '../../models/quiz.model';
import { AttemptStatus } from '../../models/attempt.model';

describe('QuizTakePageComponent', () => {
  let component: QuizTakePageComponent;
  let fixture: ComponentFixture<QuizTakePageComponent>;
  let mockQuizzes: jasmine.SpyObj<QuizzesStore>;
  let mockAttempts: jasmine.SpyObj<AttemptsStore>;

  const createQuiz = (): QuizDetail => ({
    publicUuid: 'q-1',
    sectionPublicUuid: 's-1',
    title: 'Quiz',
    description: null,
    status: QuizStatus.Published,
    dueAt: null,
    timeLimitMinutes: 10,
    maxAttempts: 2,
    maxScore: 100,
    ownerPublicUuid: 'tch-1',
    publishedAt: '2026-01-01T00:00:00.000Z',
    closedAt: null,
    questionCount: 1,
    totalPoints: 5,
    revealCorrectness: false,
    questions: [
      {
        publicUuid: 'qq-1',
        type: QuestionType.MultipleChoice,
        prompt: '¿2+2?',
        points: 5,
        position: 1,
        correctText: null,
        expectedKeywords: null,
        correctBoolean: null,
        options: [
          { publicUuid: 'o-1', label: '4', isCorrect: true, explanation: null, position: 0 },
          { publicUuid: 'o-2', label: '5', isCorrect: false, explanation: null, position: 1 },
        ],
      },
    ],
    createdAt: new Date(),
    updatedAt: null,
  });

  const createAttempt = () => ({
    publicUuid: 'att-1',
    quizPublicUuid: 'q-1',
    studentPublicUuid: 'st-1',
    status: AttemptStatus.InProgress,
    attemptNumber: 1,
    score: null,
    maxScore: 100,
    expiresAt: new Date(Date.now() + 600000),
    startedAt: new Date(),
    submittedAt: null,
    gradedAt: null,
    revealCorrectness: false,
    answers: [],
  });

  beforeEach(async () => {
    mockQuizzes = jasmine.createSpyObj<QuizzesStore>('QuizzesStore', ['loadDetail']);
    mockQuizzes.loadDetail.and.returnValue(Promise.resolve(createQuiz()));

    const attemptSig = signal(createAttempt());
    mockAttempts = jasmine.createSpyObj<AttemptsStore>(
      'AttemptsStore',
      [
        'startAttempt',
        'setPendingAnswer',
        'flushPendingAnswers',
        'submitAttempt',
        'findAnswer',
        'clearCurrent',
        'clearError',
      ],
      {
        current: attemptSig,
        loadingCurrent: signal(false),
        saving: signal(false),
        submitting: signal(false),
        lastSavedAt: signal(null),
        lastSaveError: signal(null),
        error: signal(null),
        hasPending: signal(false),
        pendingAnswers: signal({}),
      },
    );

    mockAttempts.startAttempt.and.returnValue(Promise.resolve(true));
    mockAttempts.flushPendingAnswers.and.returnValue(Promise.resolve());
    mockAttempts.submitAttempt.and.returnValue(Promise.resolve(null));

    await TestBed.configureTestingModule({
      imports: [QuizTakePageComponent],
      providers: [
        provideRouter([]),
        { provide: QuizzesStore, useValue: mockQuizzes },
        { provide: AttemptsStore, useValue: mockAttempts },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuizTakePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('isInProgress true para IN_PROGRESS', () => {
    expect(component.isInProgress(createAttempt())).toBeTrue();
  });

  it('submittedDescription retorna texto según estado', () => {
    const a = createAttempt();
    a.status = AttemptStatus.Graded;
    a.score = 80;
    a.maxScore = 100;
    expect(component.submittedDescription(a)).toContain('80');
  });

  it('findQuestion encuentra pregunta', () => {
    const q = component.findQuestion('qq-1');
    expect(q?.prompt).toBe('¿2+2?');
  });

  it('findQuestion retorna null si no existe', () => {
    expect(component.findQuestion('no-existe')).toBeNull();
  });

  it('formatAnswer formatea opción MC', () => {
    const q = createQuiz().questions[0];
    const ans = {
      publicUuid: 'a-1',
      questionPublicUuid: 'qq-1',
      selectedOptionId: 'o-1',
      selectedBoolean: null,
      textAnswer: null,
      isCorrect: null,
      pointsAwarded: null,
    };
    expect(component.formatAnswer(ans, q)).toBe('4');
  });

  it('formatAnswer formatea boolean', () => {
    const ans = {
      publicUuid: 'a-1',
      questionPublicUuid: 'qq-1',
      selectedOptionId: null,
      selectedBoolean: true,
      textAnswer: null,
      isCorrect: null,
      pointsAwarded: null,
    };
    expect(component.formatAnswer(ans, null)).toBe('Verdadero');
  });

  it('formatAnswer formatea text', () => {
    const ans = {
      publicUuid: 'a-1',
      questionPublicUuid: 'qq-1',
      selectedOptionId: null,
      selectedBoolean: null,
      textAnswer: 'Mi respuesta',
      isCorrect: null,
      pointsAwarded: null,
    };
    expect(component.formatAnswer(ans, null)).toBe('Mi respuesta');
  });

  it('canReveal true si revealCorrectness', () => {
    const a = createAttempt();
    a.revealCorrectness = true;
    expect(component.canReveal(a)).toBeTrue();
  });

  it('canReveal true si Graded', () => {
    const a = createAttempt();
    a.status = AttemptStatus.Graded;
    expect(component.canReveal(a)).toBeTrue();
  });

  it('timerLabel formatea segundos', () => {
    component.timerSeconds.set(125);
    expect(component.timerLabel()).toBe('02:05');
  });

  it('timerLabel null si timerSeconds null', () => {
    component.timerSeconds.set(null);
    expect(component.timerLabel()).toBeNull();
  });

  it('timerClass cambia según tiempo restante', () => {
    component.timerSeconds.set(30);
    expect(component.timerClass()).toContain('text-red');
    component.timerSeconds.set(120);
    expect(component.timerClass()).toContain('text-amber');
    component.timerSeconds.set(600);
    expect(component.timerClass()).toContain('text-content-muted');
  });
});
