import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { QuizGradePageComponent } from './quiz-grade.page';
import { AttemptsStore } from '../../store/attempts.store';
import { GradingQueueItem } from '../../models/attempt.model';

function makeItem(
  attemptPublicUuid: string,
  answerPublicUuid: string,
  questionPoints: number,
  textAnswer = 'una respuesta',
): GradingQueueItem {
  return {
    attemptPublicUuid,
    studentUserId: 'stu-1',
    quizTitle: 'Quiz demo',
    questionPublicUuid: `q-${answerPublicUuid}`,
    questionPrompt: '¿Cuál es la capital de Francia?',
    textAnswer,
    questionPoints,
    answerPublicUuid,
  };
}

interface PageAccess {
  gradeControlKey: (a: string, p: number) => string;
  feedbackControlKey: (a: string) => string;
  groupIsValid: (g: { items: GradingQueueItem[] }) => boolean;
  resultsRoute: () => string;
}

function setup(): QuizGradePageComponent {
  const fakeStore = {
    queue: () => [] as GradingQueueItem[],
    loadingQueue: () => false,
    error: () => null,
    saving: () => false,
    loadQueue: jasmine.createSpy('loadQueue').and.returnValue(Promise.resolve()),
    gradeAttempt: jasmine.createSpy('gradeAttempt').and.returnValue(Promise.resolve(null)),
  } as unknown as AttemptsStore;

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ uuid: 'qz-1' }) } },
      },
      { provide: AttemptsStore, useValue: fakeStore },
    ],
  });
  const fixture = TestBed.createComponent(QuizGradePageComponent);
  fixture.detectChanges();
  return fixture.componentInstance;
}

function access(page: QuizGradePageComponent): PageAccess {
  return page as unknown as PageAccess;
}

describe('QuizGradePageComponent (FE-7b.3) — control key helpers', () => {
  it('gradeControlKey encodes answer uuid and max points', () => {
    const page = setup();
    expect(access(page).gradeControlKey('ans-1', 5)).toBe('g:ans-1:5');
  });

  it('gradeControlKey encodes different points distinctly', () => {
    const page = setup();
    expect(access(page).gradeControlKey('ans-1', 10)).toBe('g:ans-1:10');
    expect(access(page).gradeControlKey('ans-1', 1)).toBe('g:ans-1:1');
  });

  it('feedbackControlKey is namespaced with "fb:" prefix', () => {
    const page = setup();
    expect(access(page).feedbackControlKey('att-9')).toBe('fb:att-9');
  });

  it('feedbackControlKey differentiates between attempts', () => {
    const page = setup();
    expect(access(page).feedbackControlKey('att-a')).not.toBe(
      access(page).feedbackControlKey('att-b'),
    );
  });
});

describe('QuizGradePageComponent (FE-7b.3) — groupIsValid (pure logic)', () => {
  it('returns true for an empty group (no items means no invalid)', () => {
    const page = setup();
    const emptyGroup = { attemptPublicUuid: 'att-x', studentUserId: 'stu-x', items: [] };
    expect(access(page).groupIsValid(emptyGroup)).toBeTrue();
  });
});

describe('QuizGradePageComponent (FE-7b.3) — routing', () => {
  it('resultsRoute yields the LMS.quizResults path for the current quiz', () => {
    const page = setup();
    expect(access(page).resultsRoute()).toContain('qz-1');
  });
});

describe('QuizGradePageComponent (FE-7b.3) — makeItem fixture', () => {
  it('encodes the expected fields (sanity check for the helpers)', () => {
    const item = makeItem('att-1', 'ans-1', 5, 'texto');
    expect(item.attemptPublicUuid).toBe('att-1');
    expect(item.answerPublicUuid).toBe('ans-1');
    expect(item.questionPoints).toBe(5);
    expect(item.textAnswer).toBe('texto');
    expect(item.questionPublicUuid).toBe('q-ans-1');
  });
});
