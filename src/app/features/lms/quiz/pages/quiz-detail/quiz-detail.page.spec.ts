import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { QuizDetailPageComponent } from './quiz-detail.page';
import { QuizzesStore } from '../../store/quizzes.store';
import { AuthService } from '@core/services';
import { Permission } from '@core/enums';
import { QuizStatus } from '../../models/quiz.model';

describe('QuizDetailPageComponent', () => {
  let component: QuizDetailPageComponent;
  let fixture: ComponentFixture<QuizDetailPageComponent>;
  let mockStore: jasmine.SpyObj<QuizzesStore>;
  let mockAuth: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    const quiz = {
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
      questionCount: 0,
      totalPoints: 0,
      revealCorrectness: false,
      questions: [],
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

    mockAuth = jasmine.createSpyObj<AuthService>('AuthService', ['hasPermission']);

    await TestBed.configureTestingModule({
      imports: [QuizDetailPageComponent],
      providers: [
        provideRouter([]),
        { provide: QuizzesStore, useValue: mockStore },
        { provide: AuthService, useValue: mockAuth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuizDetailPageComponent);
    component = fixture.componentInstance;
    component['#quizUuid'] = 'q-1';
    fixture.detectChanges();
  });

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('canEdit true en Draft', () => {
    expect(component.canEdit()).toBeTrue();
  });

  it('canPublish true en Draft', () => {
    expect(component.canPublish()).toBeTrue();
  });

  it('canClose false en Draft', () => {
    expect(component.canClose()).toBeFalse();
  });

  it('canRevealCorrectness false sin permisos', () => {
    mockAuth.hasPermission.and.returnValue(false);
    expect(component.canRevealCorrectness()).toBeFalse();
  });

  it('canRevealCorrectness true si revealCorrectness', () => {
    const store = TestBed.inject(QuizzesStore) as any;
    store.selected.set({
      ...store.selected(),
      revealCorrectness: true,
    });
    expect(component.canRevealCorrectness()).toBeTrue();
  });

  it('onPublish llama al store', async () => {
    mockStore.publishQuiz.and.returnValue(Promise.resolve(null));
    await component.onPublish();
    expect(mockStore.publishQuiz).toHaveBeenCalledWith('q-1');
  });

  it('onClose llama al store', async () => {
    mockStore.closeQuiz.and.returnValue(Promise.resolve(null));
    await component.onClose();
    expect(mockStore.closeQuiz).toHaveBeenCalledWith('q-1');
  });

  it('reload recarga detail', () => {
    component.reload();
    expect(mockStore.loadDetail).toHaveBeenCalledWith('q-1');
  });
});
