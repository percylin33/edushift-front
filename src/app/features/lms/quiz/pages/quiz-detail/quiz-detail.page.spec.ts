import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { QuizDetailPageComponent } from './quiz-detail.page';
import { QuizzesStore } from '../../store/quizzes.store';
import { AuthService } from '@core/services';
import { Permission } from '@core/enums';
import { QuizDetail, QuizStatus, QuestionType } from '../../models/quiz.model';

describe('QuizDetailPageComponent', () => {
  let component: QuizDetailPageComponent;
  let fixture: ComponentFixture<QuizDetailPageComponent>;
  let mockStore: jasmine.SpyObj<QuizzesStore>;
  let mockAuth: jasmine.SpyObj<AuthService>;
  const testApi = () =>
    component as unknown as {
      canEdit(): boolean;
      canPublish(): boolean;
      canClose(): boolean;
      canRevealCorrectness(): boolean;
      onPublish(): Promise<unknown>;
      onClose(): Promise<unknown>;
      reload(): void;
    };

  beforeEach(async () => {
    const quiz: QuizDetail = {
      publicUuid: 'q-1',
      sectionPublicUuid: 's-1',
      title: 'Quiz 1',
      description: 'Desc',
      status: QuizStatus.Draft,
      dueAt: null,
      timeLimitMinutes: null,
      maxAttempts: 1,
      maxScore: 100,
      ownerPublicUuid: 'tch-1',
      publishedAt: null,
      closedAt: null,
      questionCount: 1,
      totalPoints: 100,

      revealCorrectness: false,
      questions: [
        {
          publicUuid: 'question-1',
          type: QuestionType.TrueFalse,
          prompt: '¿Es correcto?',
          points: 100,
          position: 1,
          correctText: null,
          expectedKeywords: null,
          correctBoolean: true,
          options: [],
        },
      ],
      createdAt: new Date(),
      updatedAt: null,
    };

    mockStore = jasmine.createSpyObj<QuizzesStore>(
      'QuizzesStore',
      ['loadDetail', 'publishQuiz', 'closeQuiz', 'clearError'],
      {
        selected: signal(quiz),
        loadingDetail: signal(false),
        error: signal(null),
        saving: signal(false),
      },
    );

    mockStore.loadDetail.and.returnValue(Promise.resolve(quiz));

    mockAuth = jasmine.createSpyObj<AuthService>(
      'AuthService',
      ['hasPermission'],
      { permissions: signal<Permission[]>([]) },
    );

    await TestBed.configureTestingModule({
      imports: [QuizDetailPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (key: string) => (key === 'uuid' ? 'q-1' : null) },
            },
          },
        },
        { provide: QuizzesStore, useValue: mockStore },
        { provide: AuthService, useValue: mockAuth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuizDetailPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('canEdit true en Draft', () => {
    expect(testApi().canEdit()).toBeTrue();
  });

  it('canPublish true en Draft', () => {
    expect(testApi().canPublish()).toBeTrue();
  });

  it('canClose false en Draft', () => {
    expect(testApi().canClose()).toBeFalse();
  });

  it('canRevealCorrectness false sin permisos', () => {
    mockAuth.hasPermission.and.returnValue(false);
    expect(testApi().canRevealCorrectness()).toBeFalse();
  });

  it('canRevealCorrectness true si revealCorrectness', () => {
    const store = TestBed.inject(QuizzesStore);
    const selected = store.selected as unknown as WritableSignal<QuizDetail | null>;
    selected.set({
      ...selected()!,
      revealCorrectness: true,
    });
    expect(testApi().canRevealCorrectness()).toBeTrue();
  });

  it('onPublish llama al store', async () => {
    mockStore.publishQuiz.and.returnValue(Promise.resolve(null));
    await testApi().onPublish();
    expect(mockStore.publishQuiz).toHaveBeenCalledWith('q-1');
  });

  it('onClose llama al store', async () => {
    mockStore.closeQuiz.and.returnValue(Promise.resolve(null));
    await testApi().onClose();
    expect(mockStore.closeQuiz).toHaveBeenCalledWith('q-1');
  });

  it('reload recarga detail', () => {
    testApi().reload();
    expect(mockStore.loadDetail).toHaveBeenCalledWith('q-1');
  });
});
