import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { QuizResultsPageComponent } from './quiz-results.page';
import { AuthService } from '../../../../../core/services/auth.service';
import { AttemptsStore } from '../../store/attempts.store';
import { QuizzesStore } from '../../store/quizzes.store';
import {
  AnswerRow,
  AnswerStatus,
  AttemptDetail,
  AttemptStatus,
  AttemptSummaryRow,
} from '../../models/attempt.model';
import { QuestionRow, QuestionType } from '../../models/quiz.model';
import { Permission } from '../../../../../core/enums/permission.enum';

function makeSummary(
  publicUuid: string,
  status: AttemptStatus = AttemptStatus.AutoGraded,
): AttemptSummaryRow {
  return {
    publicUuid,
    quizPublicUuid: 'qz-1',
    studentUserId: 'stu-1',
    attemptNumber: 1,
    status,
    autoScore: 4,
    manualScore: 0,
    score: 4,
    maxScore: 5,
    pendingAnswerCount: 0,
    startedAt: new Date('2026-06-01T10:00:00Z'),
    submittedAt: new Date('2026-06-01T10:15:00Z'),
    gradedAt: new Date('2026-06-01T10:20:00Z'),
    createdAt: new Date('2026-06-01T10:00:00Z'),
  };
}

function makeQuestion(publicUuid: string, prompt: string, options: string[]): QuestionRow {
  return {
    publicUuid,
    prompt,
    type: QuestionType.MultipleChoice,
    points: 5,
    position: 0,
    correctText: null,
    expectedKeywords: null,
    correctBoolean: null,
    options: options.map((label, i) => ({
      publicUuid: `${publicUuid}-opt-${i}`,
      label,
      isCorrect: i === 0 ? true : null,
      explanation: null,
      position: i,
    })),
  };
}

function makeAnswer(overrides: Partial<AnswerRow> = {}): AnswerRow {
  return {
    publicUuid: 'ans-1',
    questionPublicUuid: 'q-1',
    selectedOptionId: null,
    selectedBoolean: null,
    textAnswer: null,
    correct: null,
    pointsAwarded: null,
    gradedByUserId: null,
    gradedAt: null,
    updatedAt: null,
    status: AnswerStatus.Empty,
    ...overrides,
  };
}

function makeAttempt(publicUuid: string, answers: AnswerRow[]): AttemptDetail {
  return {
    publicUuid,
    quizPublicUuid: 'qz-1',
    studentUserId: 'stu-1',
    submitterUserId: 'stu-1',
    attemptNumber: 1,
    status: AttemptStatus.AutoGraded,
    startedAt: new Date('2026-06-01T10:00:00Z'),
    submittedAt: new Date('2026-06-01T10:15:00Z'),
    expiresAt: null,
    timeRemainingSeconds: null,
    autoScore: 4,
    manualScore: 0,
    score: 4,
    maxScore: 5,
    gradedByUserId: null,
    gradedAt: new Date('2026-06-01T10:20:00Z'),
    feedback: null,
    revealCorrectness: true,
    answers,
    createdAt: new Date('2026-06-01T10:00:00Z'),
    updatedAt: new Date('2026-06-01T10:20:00Z'),
  };
}

interface SetupOpts {
  summaries?: AttemptSummaryRow[];
  canGrade?: boolean;
  detail?: AttemptDetail | null;
  quizQuestions?: QuestionRow[];
}

interface PageAccess {
  shortId: (s: string) => string;
  formatAnswer: (a: AnswerRow) => string;
  findQuestion: (uuid: string) => QuestionRow | null;
  isExpanded: (uuid: string) => boolean;
  toggleRow: (uuid: string) => Promise<void>;
  canGrade: () => boolean;
  emptyDescription: () => string;
  quiz: { set: (q: { title: string; questions: QuestionRow[] } | null) => void };
}

function access(page: QuizResultsPageComponent): PageAccess {
  return page as unknown as PageAccess;
}

function setup(opts: SetupOpts = {}): QuizResultsPageComponent {
  const { summaries = [], canGrade = false, detail = null, quizQuestions = [] } = opts;

  const fakeAttempts = {
    summaries: () => summaries,
    loadingSummaries: () => false,
    error: () => null,
    current: () => detail,
    loadSummaries: jasmine.createSpy('loadSummaries').and.returnValue(Promise.resolve()),
    loadAttempt: jasmine.createSpy('loadAttempt').and.returnValue(Promise.resolve(detail)),
  } as unknown as AttemptsStore;

  const quiz = { title: 'Quiz demo', questions: quizQuestions };
  const fakeQuizzes = {
    loadDetail: jasmine.createSpy('loadDetail').and.returnValue(Promise.resolve(quiz)),
  } as unknown as QuizzesStore;

  const fakeAuth = {
    hasPermission: (perm: Permission) => (perm === Permission.LmsQuizGrade ? canGrade : false),
  } as unknown as AuthService;

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ uuid: 'qz-1' }) } },
      },
      { provide: AttemptsStore, useValue: fakeAttempts },
      { provide: QuizzesStore, useValue: fakeQuizzes },
      { provide: AuthService, useValue: fakeAuth },
    ],
  });
  const fixture = TestBed.createComponent(QuizResultsPageComponent);
  fixture.detectChanges();
  // Inject quiz into the page's local signal (loadDetail returns a quiz, the
  // page stores it via `this.quiz.set(quiz)` inside `bootstrap`).
  const page = fixture.componentInstance;
  access(page).quiz.set(quiz);
  fixture.detectChanges();
  return page;
}

describe('QuizResultsPageComponent (FE-7b.3) — display helpers', () => {
  it('shortId truncates to 8 chars', () => {
    const page = setup();
    expect(access(page).shortId('abc12345-uuid-extended')).toBe('abc12345');
  });

  it('shortId returns the input when shorter than 8 chars', () => {
    const page = setup();
    expect(access(page).shortId('ab')).toBe('ab');
  });

  it('formatAnswer returns the option label for MC answers', () => {
    const q = makeQuestion('q-1', '¿Color?', ['Rojo', 'Azul']);
    const attempt = makeAttempt('att-1', [makeAnswer({ selectedOptionId: 'q-1-opt-1' })]);
    const page = setup({ detail: attempt, quizQuestions: [q] });
    expect(access(page).formatAnswer(attempt.answers[0])).toBe('Azul');
  });

  it('formatAnswer returns "Verdadero"/"Falso" for TF answers', () => {
    const attempt = makeAttempt('att-1', [makeAnswer({ selectedBoolean: true })]);
    const page = setup({ detail: attempt });
    expect(access(page).formatAnswer(attempt.answers[0])).toBe('Verdadero');
  });

  it('formatAnswer returns the text for SHORT_ANSWER answers', () => {
    const attempt = makeAttempt('att-1', [makeAnswer({ textAnswer: 'Mi respuesta libre' })]);
    const page = setup({ detail: attempt });
    expect(access(page).formatAnswer(attempt.answers[0])).toBe('Mi respuesta libre');
  });

  it('formatAnswer returns "(sin respuesta)" when the answer is empty', () => {
    const attempt = makeAttempt('att-1', [makeAnswer()]);
    const page = setup({ detail: attempt });
    expect(access(page).formatAnswer(attempt.answers[0])).toBe('(sin respuesta)');
  });

  it('findQuestion returns the matching question from the loaded quiz', () => {
    const q = makeQuestion('q-1', '¿Capital de Francia?', ['París', 'Londres']);
    const page = setup({ quizQuestions: [q] });
    expect(access(page).findQuestion('q-1')?.prompt).toBe('¿Capital de Francia?');
  });

  it('findQuestion returns null for unknown question public uuid', () => {
    const page = setup({ quizQuestions: [] });
    expect(access(page).findQuestion('q-unknown')).toBeNull();
  });
});

describe('QuizResultsPageComponent (FE-7b.3) — expand/collapse', () => {
  it('isExpanded is false by default', () => {
    const page = setup();
    expect(access(page).isExpanded('att-1')).toBeFalse();
  });

  it('toggleRow expands a row and triggers loadAttempt', async () => {
    const detail = makeAttempt('att-1', []);
    const page = setup({ detail });
    await access(page).toggleRow('att-1');
    expect(access(page).isExpanded('att-1')).toBeTrue();
    const store = TestBed.inject(AttemptsStore);
    expect(store.loadAttempt as jasmine.Spy).toHaveBeenCalledWith('att-1');
  });

  it('toggleRow collapses a row that is already expanded', async () => {
    const detail = makeAttempt('att-1', []);
    const page = setup({ detail });
    await access(page).toggleRow('att-1');
    expect(access(page).isExpanded('att-1')).toBeTrue();
    await access(page).toggleRow('att-1');
    expect(access(page).isExpanded('att-1')).toBeFalse();
  });

  it('expanding a new row collapses the previous one (single-expand)', async () => {
    const detail = makeAttempt('att-2', []);
    const page = setup({ detail });
    await access(page).toggleRow('att-1');
    expect(access(page).isExpanded('att-1')).toBeTrue();
    await access(page).toggleRow('att-2');
    expect(access(page).isExpanded('att-1')).toBeFalse();
    expect(access(page).isExpanded('att-2')).toBeTrue();
  });
});

describe('QuizResultsPageComponent (FE-7b.3) — RBAC', () => {
  it('canGrade is true for users with LmsQuizGrade', () => {
    const page = setup({ canGrade: true });
    expect(access(page).canGrade()).toBeTrue();
  });

  it('canGrade is false for students', () => {
    const page = setup({ canGrade: false });
    expect(access(page).canGrade()).toBeFalse();
  });

  it('emptyDescription for teacher mentions "Ningún estudiante"', () => {
    const teacher = setup({ canGrade: true });
    expect(access(teacher).emptyDescription()).toContain('Ningún estudiante');
  });

  it('emptyDescription for student mentions "no has tomado"', () => {
    const student = setup({ canGrade: false });
    expect(access(student).emptyDescription()).toContain('no has tomado');
  });
});
