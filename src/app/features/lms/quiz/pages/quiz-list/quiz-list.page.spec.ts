import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { QuizListPageComponent } from './quiz-list.page';
import { QuizzesStore } from '../../store/quizzes.store';
import { QuizStatus, ALL_QUIZ_STATUSES } from '../../models/quiz.model';

describe('QuizListPageComponent', () => {
  let component: any;
  let fixture: ComponentFixture<QuizListPageComponent>;
  let mockStore: jasmine.SpyObj<QuizzesStore>;

  beforeEach(async () => {
    mockStore = jasmine.createSpyObj<QuizzesStore>(
      'QuizzesStore',
      ['loadBySection', 'setStatusFilter', 'publishQuiz', 'closeQuiz', 'clearError'],
      {
        rows: signal([]),
        loading: signal(false),
        error: signal(null),
        saving: signal(false),
      },
    );

    await TestBed.configureTestingModule({
      imports: [QuizListPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (key: string) => (key === 'sectionUuid' ? 's-1' : null) },
              queryParamMap: { get: () => null },
            },
          },
        },
        { provide: QuizzesStore, useValue: mockStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuizListPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('statuses tiene ALL_QUIZ_STATUSES', () => {
    expect(component.statuses).toBe(ALL_QUIZ_STATUSES);
  });

  it('statusLabel retorna español', () => {
    expect(component.statusLabel(QuizStatus.Draft)).toBe('Borrador');
    expect(component.statusLabel(QuizStatus.Published)).toBe('Publicado');
    expect(component.statusLabel(QuizStatus.Closed)).toBe('Cerrado');
  });

  it('emptyTitle retorna string', () => {
    expect(component.emptyTitle()).toBe('Aún no hay prácticas');
  });

  it('emptyDescription sin filtro', () => {
    expect(component.emptyDescription()).toContain('primera práctica');
  });

  it('onStatusChange actualiza filtro', () => {
    component.onStatusChange(QuizStatus.Published);
    expect(component.statusFilter()).toBe(QuizStatus.Published);
    expect(mockStore.loadBySection).toHaveBeenCalledWith('s-1', {
      status: QuizStatus.Published,
      assignmentPublicUuid: undefined,
    });
  });

  it('reload llama clearError y loadBySection', () => {
    component.reload();
    expect(mockStore.clearError).toHaveBeenCalled();
    expect(mockStore.loadBySection).toHaveBeenCalledWith('s-1', {
      status: undefined,
      assignmentPublicUuid: undefined,
    });
  });

  it('onPublish llama store.publishQuiz', async () => {
    mockStore.publishQuiz.and.returnValue(Promise.resolve(null));
    const row = {
      publicUuid: 'q-1',
      title: 'Q',
      status: QuizStatus.Draft,
      questionCount: 3,
    } as any;
    await component.onPublish(row);
    expect(mockStore.publishQuiz).toHaveBeenCalledWith('q-1');
  });

  it('onClose llama store.closeQuiz', async () => {
    mockStore.closeQuiz.and.returnValue(Promise.resolve(null));
    const row = { publicUuid: 'q-1' } as any;
    await component.onClose(row);
    expect(mockStore.closeQuiz).toHaveBeenCalledWith('q-1');
  });
});
