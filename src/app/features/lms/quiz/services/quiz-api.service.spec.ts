import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '@core/services';
import { QuizApiService } from './quiz-api.service';
import {
  CreateQuestionRequest,
  QuestionType,
  QuizResponseRaw,
  QuizStatus,
  toQuizDetail,
} from '../models/quiz.model';

/**
 * HTTP boundary del módulo `lms.quizzes` (FE-7b.1).
 *
 * <p>Cubre:
 * <ol>
 *   <li>listBySection llama al endpoint correcto con filtros opcionales.</li>
 *   <li>getQuiz desenvuelve ApiResponse&lt;T&gt; vía toQuizDetail.</li>
 *   <li>createQuiz / updateQuiz / publishQuiz / closeQuiz hacen la
 *       llamada correcta.</li>
 *   <li>addQuestion POSTea al sub-endpoint /quizzes/{uuid}/questions.</li>
 *   <li>addOption POSTea al sub-endpoint /questions/{uuid}/options.</li>
 * </ol>
 *
 * <p>No mockeamos {@code environment.apiUrl}; confiamos en que el
 * {@code ApiService} la inyecta. El spy solo intercepta las firmas
 * de los verbos HTTP.</p>
 */
describe('QuizApiService', () => {
  let service: QuizApiService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'patch', 'delete']);
    TestBed.configureTestingModule({
      providers: [QuizApiService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(QuizApiService);
  });

  it('listBySection hace GET a /sections/{uuid}/quizzes y mapea a QuizRow[]', (done) => {
    const page = {
      content: [
        {
          publicUuid: 'q-1',
          title: 'Q',
          status: 'DRAFT' as QuizStatus,
          dueAt: null,
          timeLimitMinutes: null,
          maxAttempts: 1,
          maxScore: 100,
          ownerPublicUuid: 'tch-1',
          questionCount: 0,
          totalPoints: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      number: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
      empty: false,
      numberOfElements: 1,
    };
    apiSpy.get.and.returnValue(of(page));

    service.listBySection('s-1').subscribe((rows) => {
      expect(rows).toHaveSize(1);
      expect(rows[0].publicUuid).toBe('q-1');
      expect(rows[0].status).toBe(QuizStatus.Draft);
      expect(apiSpy.get).toHaveBeenCalledOnceWith(
        jasmine.stringMatching(/\/sections\/s-1\/quizzes$/),
        { status: undefined },
      );
      done();
    });
  });

  it('listBySection pasa el filtro status cuando se da', (done) => {
    const page = {
      content: [],
      number: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
      first: true,
      last: true,
      empty: true,
      numberOfElements: 0,
    };
    apiSpy.get.and.returnValue(of(page));
    service.listBySection('s-1', { status: QuizStatus.Published }).subscribe(() => {
      expect(apiSpy.get).toHaveBeenCalledOnceWith(
        jasmine.stringMatching(/\/sections\/s-1\/quizzes$/),
        { status: QuizStatus.Published },
      );
      done();
    });
  });

  it('getQuiz desenvuelve ApiResponse<QuizResponseRaw> vía toQuizDetail', (done) => {
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
      questionCount: 0,
      totalPoints: 0,
      revealCorrectness: true,
      questions: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: null,
    };
    apiSpy.get.and.returnValue(of({ success: true, data: raw }));

    service.getQuiz('q-1').subscribe((detail) => {
      expect(detail).toEqual(toQuizDetail(raw));
      expect(apiSpy.get).toHaveBeenCalledOnceWith(jasmine.stringMatching(/\/quizzes\/q-1$/));
      done();
    });
  });

  it('createQuiz POSTea a /sections/{uuid}/quizzes', (done) => {
    const raw: QuizResponseRaw = {
      publicUuid: 'q-new',
      sectionPublicUuid: 's-1',
      title: 'Nuevo',
      description: null,
      status: QuizStatus.Draft,
      dueAt: null,
      timeLimitMinutes: null,
      maxAttempts: 1,
      maxScore: 50,
      ownerPublicUuid: 'tch-1',
      publishedAt: null,
      closedAt: null,
      questionCount: 0,
      totalPoints: 0,
      revealCorrectness: false,
      questions: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: null,
    };
    apiSpy.post.and.returnValue(of({ success: true, data: raw }));

    service
      .createQuiz('s-1', {
        title: 'Nuevo',
        maxAttempts: 1,
        maxScore: 50,
      })
      .subscribe((detail) => {
        expect(detail.publicUuid).toBe('q-new');
        expect(apiSpy.post).toHaveBeenCalledOnceWith(
          jasmine.stringMatching(/\/sections\/s-1\/quizzes$/),
          { title: 'Nuevo', maxAttempts: 1, maxScore: 50 },
        );
        done();
      });
  });

  it('updateQuiz PATCHea a /quizzes/{uuid}', (done) => {
    const raw: QuizResponseRaw = {
      publicUuid: 'q-1',
      sectionPublicUuid: 's-1',
      title: 'T-edit',
      description: null,
      status: QuizStatus.Draft,
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
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };
    apiSpy.patch.and.returnValue(of({ success: true, data: raw }));

    service.updateQuiz('q-1', { title: 'T-edit' }).subscribe((detail) => {
      expect(detail.title).toBe('T-edit');
      expect(apiSpy.patch).toHaveBeenCalledOnceWith(jasmine.stringMatching(/\/quizzes\/q-1$/), {
        title: 'T-edit',
      });
      done();
    });
  });

  it('deleteQuiz llama DELETE a /quizzes/{uuid}', (done) => {
    apiSpy.delete.and.returnValue(of(undefined));
    service.deleteQuiz('q-1').subscribe(() => {
      expect(apiSpy.delete).toHaveBeenCalledOnceWith(jasmine.stringMatching(/\/quizzes\/q-1$/));
      done();
    });
  });

  it('publishQuiz POSTea a /quizzes/{uuid}/publish', (done) => {
    const raw: QuizResponseRaw = {
      publicUuid: 'q-1',
      sectionPublicUuid: 's-1',
      title: 'T',
      description: null,
      status: QuizStatus.Published,
      dueAt: null,
      timeLimitMinutes: null,
      maxAttempts: 1,
      maxScore: 100,
      ownerPublicUuid: 'tch-1',
      publishedAt: '2026-01-02T00:00:00.000Z',
      closedAt: null,
      questionCount: 1,
      totalPoints: 5,
      revealCorrectness: false,
      questions: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: null,
    };
    apiSpy.post.and.returnValue(of({ success: true, data: raw }));

    service.publishQuiz('q-1').subscribe((detail) => {
      expect(detail.status).toBe(QuizStatus.Published);
      expect(apiSpy.post).toHaveBeenCalledOnceWith(
        jasmine.stringMatching(/\/quizzes\/q-1\/publish$/),
      );
      done();
    });
  });

  it('closeQuiz POSTea a /quizzes/{uuid}/close', (done) => {
    const raw: QuizResponseRaw = {
      publicUuid: 'q-1',
      sectionPublicUuid: 's-1',
      title: 'T',
      description: null,
      status: QuizStatus.Closed,
      dueAt: null,
      timeLimitMinutes: null,
      maxAttempts: 1,
      maxScore: 100,
      ownerPublicUuid: 'tch-1',
      publishedAt: '2026-01-02T00:00:00.000Z',
      closedAt: '2026-01-03T00:00:00.000Z',
      questionCount: 1,
      totalPoints: 5,
      revealCorrectness: false,
      questions: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: null,
    };
    apiSpy.post.and.returnValue(of({ success: true, data: raw }));

    service.closeQuiz('q-1').subscribe((detail) => {
      expect(detail.status).toBe(QuizStatus.Closed);
      expect(apiSpy.post).toHaveBeenCalledOnceWith(
        jasmine.stringMatching(/\/quizzes\/q-1\/close$/),
      );
      done();
    });
  });

  it('addQuestion POSTea a /quizzes/{uuid}/questions', (done) => {
    const qRaw = {
      publicUuid: 'qq-1',
      type: QuestionType.MultipleChoice,
      prompt: 'P',
      points: 5,
      position: 1,
      correctText: null,
      expectedKeywords: null,
      correctBoolean: null,
      options: [],
    };
    apiSpy.post.and.returnValue(of({ success: true, data: qRaw }));

    const req: CreateQuestionRequest = {
      type: QuestionType.MultipleChoice,
      prompt: 'P',
      points: 5,
      options: [
        { label: 'A', isCorrect: true, explanation: null },
        { label: 'B', isCorrect: false, explanation: null },
      ],
    };
    service.addQuestion('q-1', req).subscribe((row) => {
      expect(row.publicUuid).toBe('qq-1');
      expect(apiSpy.post).toHaveBeenCalledOnceWith(
        jasmine.stringMatching(/\/quizzes\/q-1\/questions$/),
        req,
      );
      done();
    });
  });

  it('addOption POSTea a /questions/{uuid}/options', (done) => {
    const qRaw = {
      publicUuid: 'qq-1',
      type: QuestionType.MultipleChoice,
      prompt: 'P',
      points: 5,
      position: 1,
      correctText: null,
      expectedKeywords: null,
      correctBoolean: null,
      options: [{ publicUuid: 'o-1', label: 'A', isCorrect: true, explanation: null, position: 0 }],
    };
    apiSpy.post.and.returnValue(of({ success: true, data: qRaw }));

    service.addOption('qq-1', { label: 'A', isCorrect: true }).subscribe((row) => {
      expect(row.options[0].label).toBe('A');
      expect(apiSpy.post).toHaveBeenCalledOnceWith(
        jasmine.stringMatching(/\/questions\/qq-1\/options$/),
        { label: 'A', isCorrect: true },
      );
      done();
    });
  });
});
