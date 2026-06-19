import {
  AnswerStatus,
  AttemptStatus,
  toAnswerRow,
  toAttemptDetail,
  toAttemptSummaryRow,
  toGradingQueueItem,
  isAttemptInProgress,
  isAttemptFinal,
  isAttemptAwaitingManualGrade,
  canRevealCorrectnessFor
} from './attempt.model';

describe('attempt.model (FE-7b.2)', () => {
  describe('toAnswerRow', () => {
    it('derives AnswerStatus.Empty when no payload and no grade', () => {
      const row = toAnswerRow({
        publicUuid: 'a-1',
        questionPublicUuid: 'q-1',
        selectedOptionId: null,
        selectedBoolean: null,
        textAnswer: null,
        correct: null,
        pointsAwarded: null,
        gradedByUserId: null,
        gradedAt: null,
        updatedAt: null
      });
      expect(row.status).toBe(AnswerStatus.Empty);
    });

    it('derives AnswerStatus.Saved when payload present but no grade', () => {
      const row = toAnswerRow({
        publicUuid: 'a-1',
        questionPublicUuid: 'q-1',
        selectedOptionId: 'o-1',
        selectedBoolean: null,
        textAnswer: null,
        correct: null,
        pointsAwarded: null,
        gradedByUserId: null,
        gradedAt: null,
        updatedAt: null
      });
      expect(row.status).toBe(AnswerStatus.Saved);
    });

    it('derives AnswerStatus.AutoGraded when pointsAwarded is set but no manual grader', () => {
      const row = toAnswerRow({
        publicUuid: 'a-1',
        questionPublicUuid: 'q-1',
        selectedOptionId: 'o-1',
        selectedBoolean: null,
        textAnswer: null,
        correct: true,
        pointsAwarded: 5,
        gradedByUserId: null,
        gradedAt: null,
        updatedAt: null
      });
      expect(row.status).toBe(AnswerStatus.AutoGraded);
    });

    it('derives AnswerStatus.ManuallyGraded when gradedByUserId is set', () => {
      const row = toAnswerRow({
        publicUuid: 'a-1',
        questionPublicUuid: 'q-1',
        selectedOptionId: null,
        selectedBoolean: null,
        textAnswer: 'mi respuesta',
        correct: true,
        pointsAwarded: 3,
        gradedByUserId: 't-1',
        gradedAt: '2026-06-12T12:00:00Z',
        updatedAt: '2026-06-12T12:00:00Z'
      });
      expect(row.status).toBe(AnswerStatus.ManuallyGraded);
    });

    it('parses dates and tolerates invalid ISO strings', () => {
      const row = toAnswerRow({
        publicUuid: 'a-1',
        questionPublicUuid: 'q-1',
        selectedOptionId: 'o-1',
        selectedBoolean: null,
        textAnswer: null,
        correct: true,
        pointsAwarded: 5,
        gradedByUserId: null,
        gradedAt: '2026-06-12T12:00:00Z',
        updatedAt: 'not-a-date'
      });
      expect(row.gradedAt).toBeInstanceOf(Date);
      expect(row.updatedAt).toBeNull();
    });
  });

  describe('toAttemptDetail', () => {
    it('parses dates and maps answers via the adapter', () => {
      const detail = toAttemptDetail({
        publicUuid: 'att-1',
        quizPublicUuid: 'quiz-1',
        studentUserId: 'u-1',
        submitterUserId: 'u-1',
        attemptNumber: 1,
        status: AttemptStatus.InProgress,
        startedAt: '2026-06-12T10:00:00Z',
        submittedAt: null,
        expiresAt: '2026-06-12T10:30:00Z',
        timeRemainingSeconds: 1500,
        autoScore: null,
        manualScore: null,
        score: null,
        maxScore: 100,
        gradedByUserId: null,
        gradedAt: null,
        feedback: null,
        revealCorrectness: false,
        answers: [
          {
            publicUuid: 'a-1',
            questionPublicUuid: 'q-1',
            selectedOptionId: 'o-1',
            selectedBoolean: null,
            textAnswer: null,
            correct: null,
            pointsAwarded: null,
            gradedByUserId: null,
            gradedAt: null,
            updatedAt: '2026-06-12T10:05:00Z'
          }
        ],
        createdAt: '2026-06-12T10:00:00Z',
        updatedAt: '2026-06-12T10:05:00Z'
      });

      expect(detail.startedAt).toBeInstanceOf(Date);
      expect(detail.expiresAt).toBeInstanceOf(Date);
      expect(detail.timeRemainingSeconds).toBe(1500);
      expect(detail.answers).toHaveSize(1);
      expect(detail.answers[0].status).toBe(AnswerStatus.Saved);
      expect(detail.revealCorrectness).toBe(false);
    });

    it('falls back to epoch when startedAt is null/invalid (defensive)', () => {
      const detail = toAttemptDetail({
        publicUuid: 'att-1',
        quizPublicUuid: 'quiz-1',
        studentUserId: 'u-1',
        submitterUserId: 'u-1',
        attemptNumber: 1,
        status: AttemptStatus.Graded,
        startedAt: '',
        revealCorrectness: true,
        answers: []
      } as never);
      expect(detail.startedAt).toBeInstanceOf(Date);
    });
  });

  describe('toAttemptSummaryRow', () => {
    it('parses dates and preserves pendingAnswerCount', () => {
      const row = toAttemptSummaryRow({
        publicUuid: 'att-1',
        quizPublicUuid: 'quiz-1',
        studentUserId: 'u-1',
        attemptNumber: 2,
        status: AttemptStatus.AutoGraded,
        autoScore: 60,
        manualScore: null,
        score: null,
        maxScore: 100,
        pendingAnswerCount: 3,
        startedAt: '2026-06-12T10:00:00Z',
        submittedAt: '2026-06-12T10:15:00Z',
        gradedAt: null,
        createdAt: '2026-06-12T10:00:00Z'
      });
      expect(row.status).toBe(AttemptStatus.AutoGraded);
      expect(row.pendingAnswerCount).toBe(3);
      expect(row.autoScore).toBe(60);
      expect(row.manualScore).toBeNull();
    });
  });

  describe('toGradingQueueItem', () => {
    it('passes through the queue row', () => {
      const item = toGradingQueueItem({
        answerPublicUuid: 'a-1',
        attemptPublicUuid: 'att-1',
        questionPublicUuid: 'q-1',
        studentUserId: 'u-1',
        quizTitle: 'Quiz 1',
        questionPrompt: '¿Cuál es…?',
        questionPoints: 5,
        textAnswer: 'mi respuesta'
      });
      expect(item.quizTitle).toBe('Quiz 1');
      expect(item.questionPoints).toBe(5);
    });
  });

  describe('helpers', () => {
    it('isAttemptInProgress: true only for IN_PROGRESS', () => {
      expect(isAttemptInProgress({ status: AttemptStatus.InProgress })).toBeTrue();
      expect(isAttemptInProgress({ status: AttemptStatus.Graded })).toBeFalse();
    });

    it('isAttemptFinal: true for GRADED and EXPIRED only', () => {
      expect(isAttemptFinal({ status: AttemptStatus.Graded })).toBeTrue();
      expect(isAttemptFinal({ status: AttemptStatus.Expired })).toBeTrue();
      expect(isAttemptFinal({ status: AttemptStatus.AutoGraded })).toBeFalse();
    });

    it('isAttemptAwaitingManualGrade: true only for AUTO_GRADED', () => {
      expect(isAttemptAwaitingManualGrade({ status: AttemptStatus.AutoGraded })).toBeTrue();
      expect(isAttemptAwaitingManualGrade({ status: AttemptStatus.Graded })).toBeFalse();
    });

    it('canRevealCorrectnessFor: respects the reveal flag and the GRADED shortcut', () => {
      expect(canRevealCorrectnessFor({ status: AttemptStatus.InProgress, revealCorrectness: false })).toBeFalse();
      expect(canRevealCorrectnessFor({ status: AttemptStatus.InProgress, revealCorrectness: true })).toBeTrue();
      expect(canRevealCorrectnessFor({ status: AttemptStatus.Graded, revealCorrectness: false })).toBeTrue();
    });
  });
});
