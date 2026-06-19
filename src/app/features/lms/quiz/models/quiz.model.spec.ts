import {
  ALL_QUIZ_STATUSES,
  QuestionType,
  QuizStatus,
  isQuizCloseable,
  isQuizEditable,
  isQuizPublishable,
  toOptionRow,
  toQuestionRow,
  toQuizDetail,
  toQuizRow
} from './quiz.model';
import type {
  OptionResponseRaw,
  QuestionResponseRaw,
  QuizResponseRaw,
  QuizSummaryRaw
} from './quiz.model';

/**
 * Adapters + pure helpers del quiz model (FE-7b.1).
 *
 * <p>Cubre:
 * <ol>
 *   <li>toQuizRow normaliza fechas y nulls.</li>
 *   <li>toQuestionRow anida options y propaga isCorrect nullable.</li>
 *   <li>toQuizDetail anida questions y computa questionCount del array
 *       (no del campo wire).</li>
 *   <li>isQuizEditable / isQuizPublishable / isQuizCloseable.</li>
 *   <li>ALL_QUIZ_STATUSES respeta el orden display.</li>
 * </ol>
 */
describe('quiz.model', () => {
  describe('toQuizRow', () => {
    it('parses ISO strings into Date', () => {
      const raw: QuizSummaryRaw = {
        publicUuid: 'q-1',
        title: 'Fracciones',
        status: QuizStatus.Published,
        dueAt: '2030-01-15T00:00:00.000Z',
        timeLimitMinutes: 30,
        maxAttempts: 2,
        maxScore: 100,
        ownerPublicUuid: 'tch-1',
        questionCount: 5,
        totalPoints: 50,
        createdAt: '2026-01-01T00:00:00.000Z'
      };
      const row = toQuizRow(raw);
      expect(row.dueAt).toBeInstanceOf(Date);
      expect(row.dueAt?.toISOString()).toBe('2030-01-15T00:00:00.000Z');
      expect(row.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(row.status).toBe(QuizStatus.Published);
    });

    it('keeps null for nullable timeLimitMinutes', () => {
      const raw: QuizSummaryRaw = {
        publicUuid: 'q-1',
        title: 'Quiz',
        status: QuizStatus.Draft,
        dueAt: null,
        timeLimitMinutes: null,
        maxAttempts: 1,
        maxScore: 0,
        ownerPublicUuid: 'tch-1',
        questionCount: 0,
        totalPoints: 0,
        createdAt: '2026-01-01T00:00:00.000Z'
      };
      const row = toQuizRow(raw);
      expect(row.timeLimitMinutes).toBeNull();
      expect(row.dueAt).toBeNull();
    });
  });

  describe('toQuestionRow', () => {
    it('maps options with isCorrect nullable (grader can be null for taker)', () => {
      const opt: OptionResponseRaw = {
        publicUuid: 'o-1',
        label: '4',
        isCorrect: true,
        explanation: 'porque 2+2',
        position: 0
      };
      const row = toOptionRow(opt);
      expect(row.isCorrect).toBeTrue();
      expect(row.explanation).toBe('porque 2+2');
    });

    it('normalizes missing isCorrect/explanation to null (taker view)', () => {
      const opt: OptionResponseRaw = {
        publicUuid: 'o-1',
        label: '5',
        isCorrect: null,
        explanation: null,
        position: 0
      };
      const row = toOptionRow(opt);
      expect(row.isCorrect).toBeNull();
      expect(row.explanation).toBeNull();
    });

    it('toQuestionRow anida options vacíos', () => {
      const raw: QuestionResponseRaw = {
        publicUuid: 'q-1',
        type: QuestionType.TrueFalse,
        prompt: '¿2+2=4?',
        points: 5,
        position: 1,
        correctText: null,
        expectedKeywords: null,
        correctBoolean: true,
        options: []
      };
      const row = toQuestionRow(raw);
      expect(row.options).toEqual([]);
      expect(row.correctBoolean).toBeTrue();
      expect(row.type).toBe(QuestionType.TrueFalse);
    });
  });

  describe('toQuizDetail', () => {
    it('anida questions y mapea fields', () => {
      const raw: QuizResponseRaw = {
        publicUuid: 'q-1',
        sectionPublicUuid: 's-1',
        title: 'T',
        description: null,
        status: QuizStatus.Draft,
        dueAt: null,
        timeLimitMinutes: null,
        maxAttempts: 1,
        maxScore: 100,
        ownerPublicUuid: 'tch-1',
        publishedAt: null,
        closedAt: null,
        questionCount: 1,
        totalPoints: 5,
        revealCorrectness: true,
        questions: [
          {
            publicUuid: 'qq-1',
            type: QuestionType.MultipleChoice,
            prompt: 'P',
            points: 5,
            position: 1,
            correctText: null,
            expectedKeywords: null,
            correctBoolean: null,
            options: []
          }
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: null
      };
      const detail = toQuizDetail(raw);
      expect(detail.questions).toHaveSize(1);
      expect(detail.revealCorrectness).toBeTrue();
    });
  });

  describe('pure helpers', () => {
    const baseDetail = {
      publicUuid: 'q-1',
      sectionPublicUuid: 's-1',
      title: 'T',
      description: null,
      dueAt: null,
      timeLimitMinutes: null,
      maxAttempts: 1,
      maxScore: 100,
      ownerPublicUuid: 'tch-1',
      publishedAt: null,
      closedAt: null,
      questionCount: 0,
      totalPoints: 0,
      revealCorrectness: false,
      questions: [],
      createdAt: new Date(),
      updatedAt: null
    };

    it('isQuizEditable true solo en DRAFT', () => {
      expect(isQuizEditable({ status: QuizStatus.Draft, ...baseDetail })).toBeTrue();
      expect(isQuizEditable({ status: QuizStatus.Published, ...baseDetail })).toBeFalse();
      expect(isQuizEditable({ status: QuizStatus.Closed, ...baseDetail })).toBeFalse();
    });

    it('isQuizPublishable requiere DRAFT + >= 1 question', () => {
      const noQuestions = { ...baseDetail, status: QuizStatus.Draft, questions: [] };
      expect(isQuizPublishable(noQuestions)).toBeFalse();
      const withQuestions = {
        ...baseDetail,
        status: QuizStatus.Draft,
        questions: [
          {
            publicUuid: 'q-1',
            type: QuestionType.TrueFalse,
            prompt: 'p',
            points: 1,
            position: 1,
            correctText: null,
            expectedKeywords: null,
            correctBoolean: true,
            options: []
          }
        ]
      };
      expect(isQuizPublishable(withQuestions)).toBeTrue();
    });

    it('isQuizCloseable solo en PUBLISHED', () => {
      expect(isQuizCloseable({ status: QuizStatus.Published, ...baseDetail })).toBeTrue();
      expect(isQuizCloseable({ status: QuizStatus.Draft, ...baseDetail })).toBeFalse();
      expect(isQuizCloseable({ status: QuizStatus.Closed, ...baseDetail })).toBeFalse();
    });

    it('ALL_QUIZ_STATUSES respeta el orden display', () => {
      expect(ALL_QUIZ_STATUSES).toEqual([
        QuizStatus.Draft,
        QuizStatus.Published,
        QuizStatus.Closed
      ]);
    });
  });
});
