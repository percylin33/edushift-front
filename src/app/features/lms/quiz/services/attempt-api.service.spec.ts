import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '@core/services';
import { ApiResponse, SpringPage } from '@core/models';
import { AttemptApiService } from './attempt-api.service';
import {
  AnswerResponseRaw,
  AttemptResponseRaw,
  AttemptStatus,
  AttemptSummaryRaw,
  GradingQueueItemRaw
} from '../models/attempt.model';

describe('AttemptApiService (FE-7b.2)', () => {
  let service: AttemptApiService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const attemptRaw: AttemptResponseRaw = {
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
    updatedAt: '2026-06-12T10:00:00Z'
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', [
      'get',
      'post',
      'patch',
      'put',
      'delete'
    ]);
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiSpy }, AttemptApiService]
    });
    service = TestBed.inject(AttemptApiService);
  });

  it('startAttempt POSTs and unwraps the ApiResponse', (done) => {
    apiSpy.post.and.returnValue(of({ success: true, data: attemptRaw } as ApiResponse<AttemptResponseRaw>));
    service.startAttempt('quiz-1').subscribe((detail) => {
      expect(apiSpy.post).toHaveBeenCalledOnceWith(jasmine.stringMatching(/\/quizzes\/quiz-1\/attempts$/), {});
      expect(detail.publicUuid).toBe('att-1');
      expect(detail.status).toBe(AttemptStatus.InProgress);
      done();
    });
  });

  it('getAttempt GETs and unwraps the ApiResponse', (done) => {
    apiSpy.get.and.returnValue(of({ success: true, data: attemptRaw } as ApiResponse<AttemptResponseRaw>));
    service.getAttempt('att-1').subscribe((detail) => {
      expect(apiSpy.get).toHaveBeenCalledOnceWith(jasmine.stringMatching(/\/attempts\/att-1$/));
      expect(detail.publicUuid).toBe('att-1');
      done();
    });
  });

  it('saveAnswers PATCHes with the answers list', (done) => {
    apiSpy.patch.and.returnValue(of({ success: true, data: attemptRaw } as ApiResponse<AttemptResponseRaw>));
    const answers = [
      {
        questionPublicUuid: 'q-1',
        questionType: 'MC' as const,
        selectedOptionId: 'o-1',
        selectedBoolean: null,
        textAnswer: null
      }
    ];
    service.saveAnswers('att-1', answers).subscribe(() => {
      expect(apiSpy.patch).toHaveBeenCalledOnceWith(
        jasmine.stringMatching(/\/attempts\/att-1$/),
        { answers }
      );
      done();
    });
  });

  it('submitAttempt POSTs to /submit and unwraps the response', (done) => {
    apiSpy.post.and.returnValue(of({ success: true, data: attemptRaw } as ApiResponse<AttemptResponseRaw>));
    service.submitAttempt('att-1').subscribe((detail) => {
      expect(apiSpy.post).toHaveBeenCalledOnceWith(jasmine.stringMatching(/\/attempts\/att-1\/submit$/), {});
      expect(detail.status).toBe(AttemptStatus.InProgress);
      done();
    });
  });

  it('listAttempts GETs the page and maps SpringPage.content via the adapter', (done) => {
    const raw: AttemptSummaryRaw = {
      publicUuid: 'att-1',
      quizPublicUuid: 'quiz-1',
      studentUserId: 'u-1',
      attemptNumber: 1,
      status: AttemptStatus.Graded,
      autoScore: 80,
      manualScore: 20,
      score: 100,
      maxScore: 100,
      pendingAnswerCount: 0,
      startedAt: '2026-06-12T10:00:00Z',
      submittedAt: '2026-06-12T10:30:00Z',
      gradedAt: '2026-06-12T11:00:00Z',
      createdAt: '2026-06-12T10:00:00Z'
    };
    const page: SpringPage<AttemptSummaryRaw> = {
      content: [raw],
      totalElements: 1,
      totalPages: 1,
      size: 20,
      number: 0,
      first: true,
      last: true,
      numberOfElements: 1,
      empty: false
    };
    apiSpy.get.and.returnValue(of(page));
    service.listAttempts('quiz-1', { page: 0, size: 20 }).subscribe((result) => {
      expect(apiSpy.get).toHaveBeenCalledOnceWith(
        jasmine.stringMatching(/\/quizzes\/quiz-1\/attempts$/),
        { page: 0, size: 20, sort: undefined }
      );
      expect(result.content).toHaveSize(1);
      expect(result.content[0].status).toBe(AttemptStatus.Graded);
      expect(result.content[0].pendingAnswerCount).toBe(0);
      done();
    });
  });

  it('getGradingQueue GETs and maps each queue item', (done) => {
    const raw: GradingQueueItemRaw = {
      answerPublicUuid: 'a-1',
      attemptPublicUuid: 'att-1',
      questionPublicUuid: 'q-1',
      studentUserId: 'u-1',
      quizTitle: 'Quiz 1',
      questionPrompt: 'Pregunta abierta',
      questionPoints: 5,
      textAnswer: 'mi respuesta'
    };
    apiSpy.get.and.returnValue(of({ success: true, data: [raw] } as ApiResponse<GradingQueueItemRaw[]>));
    service.getGradingQueue('quiz-1').subscribe((items) => {
      expect(apiSpy.get).toHaveBeenCalledOnceWith(jasmine.stringMatching(/\/quizzes\/quiz-1\/grading-queue$/));
      expect(items).toHaveSize(1);
      expect(items[0].quizTitle).toBe('Quiz 1');
      done();
    });
  });

  it('gradeAttempt POSTs the request and unwraps the response', (done) => {
    apiSpy.post.and.returnValue(of({ success: true, data: attemptRaw } as ApiResponse<AttemptResponseRaw>));
    service
      .gradeAttempt('att-1', { grades: [{ answerPublicUuid: 'a-1', pointsAwarded: 5 }] })
      .subscribe((detail) => {
        expect(apiSpy.post).toHaveBeenCalledOnceWith(
          jasmine.stringMatching(/\/attempts\/att-1\/grade$/),
          { grades: [{ answerPublicUuid: 'a-1', pointsAwarded: 5 }] }
        );
        expect(detail.publicUuid).toBe('att-1');
        done();
      });
  });

  it('overrideAnswerGrade PATCHes the single-answer endpoint', (done) => {
    apiSpy.patch.and.returnValue(of({ success: true, data: attemptRaw } as ApiResponse<AttemptResponseRaw>));
    service.overrideAnswerGrade('quiz-1', 'att-1', 'a-1', 3).subscribe(() => {
      expect(apiSpy.patch).toHaveBeenCalledOnceWith(
        jasmine.stringMatching(/\/quizzes\/quiz-1\/attempts\/att-1\/answers\/a-1$/),
        { answerPublicUuid: 'a-1', pointsAwarded: 3 }
      );
      done();
    });
  });

  it('saveAnswers maps each embedded answer via the adapter', (done) => {
    const rawWithAnswers: AttemptResponseRaw = {
      ...attemptRaw,
      answers: [
        {
          publicUuid: 'a-1',
          questionPublicUuid: 'q-1',
          selectedOptionId: 'o-1',
          selectedBoolean: null,
          textAnswer: null,
          correct: true,
          pointsAwarded: 5,
          gradedByUserId: null,
          gradedAt: null,
          updatedAt: '2026-06-12T10:05:00Z'
        } as AnswerResponseRaw
      ]
    };
    apiSpy.patch.and.returnValue(of({ success: true, data: rawWithAnswers } as ApiResponse<AttemptResponseRaw>));
    service
      .saveAnswers('att-1', [
        {
          questionPublicUuid: 'q-1',
          questionType: 'MC',
          selectedOptionId: 'o-1',
          selectedBoolean: null,
          textAnswer: null
        }
      ])
      .subscribe((detail) => {
        expect(detail.answers).toHaveSize(1);
        expect(detail.answers[0].pointsAwarded).toBe(5);
        done();
      });
  });
});
