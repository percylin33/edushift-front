import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { QuizFormPageComponent } from './quiz-form.page';
import { QuizzesStore } from '../../store/quizzes.store';
import { AiAssistantService } from '../../services/ai-assistant.service';
import { AuthService } from '@core/services/auth.service';
import { Permission } from '@core/enums';
import {
  QuestionType,
  QuestionRow,
  CreateQuizRequest,
  QuizStatus,
  QuizDetail,
} from '../../models/quiz.model';
import { CreateAiQuestionRequest } from '../../models/ai-assistant.model';

/**
 * Mocks a QuizStore con spies para `addQuestion`, `loadDetail`, `createQuiz`.
 */
class FakeQuizzesStore {
  readonly selected = signal<QuizDetail | null>(null);
  readonly loadingDetail = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  addQuestionCalls: Array<{ quizUuid: string; req: unknown }> = [];
  addQuestionResult: QuestionRow | 'ERROR' = makeQuestionRow(QuestionType.MultipleChoice);
  loadDetailCalls: string[] = [];
  createQuizCalls: Array<{ section: string; req: CreateQuizRequest }> = [];
  updateQuizCalls: unknown[] = [];
  publishQuizCalls: string[] = [];

  async addQuestion(quizUuid: string, req: unknown): Promise<QuestionRow | null> {
    this.addQuestionCalls.push({ quizUuid, req });
    if (this.addQuestionResult === 'ERROR') return null;
    const current = this.selected();
    if (current) {
      this.selected.set({
        ...current,
        questions: [...current.questions, this.addQuestionResult],
        questionCount: current.questions.length + 1,
      });
    }
    return this.addQuestionResult;
  }

  async loadDetail(quizUuid: string): Promise<QuizDetail | null> {
    this.loadDetailCalls.push(quizUuid);
    if (!this.selected()) this.selected.set(makeDetail());
    return this.selected();
  }

  async createQuiz(sectionUuid: string, req: CreateQuizRequest): Promise<QuizDetail | null> {
    this.createQuizCalls.push({ section: sectionUuid, req });
    const detail = makeDetail({
      title: req.title,
      maxAttempts: req.maxAttempts,
      maxScore: req.maxScore,
    });
    this.selected.set(detail);
    return detail;
  }

  async updateQuiz(
    _uuid: string,
    patch: { title?: string },
  ): Promise<QuizDetail | null> {
    this.updateQuizCalls.push(patch);
    const current = this.selected() ?? makeDetail();
    const next = { ...current, title: patch.title ?? current.title };
    this.selected.set(next);
    return next;
  }

  async publishQuiz(uuid: string): Promise<QuizDetail | null> {
    this.publishQuizCalls.push(uuid);
    const current = this.selected();
    if (!current) return null;
    const next = { ...current, status: QuizStatus.Published };
    this.selected.set(next);
    return next;
  }
}

class FakeAiAssistantService {
  failNext: { code: string; message: string } | null = null;
  statusLabel(): string {
    return '';
  }
  suggest() {
    if (this.failNext) {
      const err = this.failNext;
      this.failNext = null;
      return throwError(() => err);
    }
    return of([]);
  }
}

class FakeAuthService {
  readonly permissions = signal<Permission[]>([]);
  readonly user = signal(null);
  readonly accessToken = signal<string | null>('test-token');
  readonly refreshToken = signal<string | null>(null);
  readonly expiresAt = signal<Date | null>(null);
}

function makeQuestionRow(type: QuestionType): QuestionRow {
  return {
    publicUuid: 'q-new',
    type,
    prompt: 'Test',
    points: 5,
    position: 1,
    correctText: null,
    expectedKeywords: null,
    correctBoolean: null,
    options: [],
  };
}

function makeDetail(overrides: Partial<QuizDetail> = {}): QuizDetail {
  return {
    publicUuid: 'q-1',
    sectionPublicUuid: 's-1',
    title: 'Quiz 1',
    description: null,
    status: QuizStatus.Draft,
    dueAt: null,
    timeLimitMinutes: null,
    maxAttempts: 1,
    maxScore: 100,
    ownerPublicUuid: 'u-1',
    publishedAt: null,
    closedAt: null,
    questionCount: 0,
    totalPoints: 0,
    revealCorrectness: true,
    questions: [],
    createdAt: new Date(),
    updatedAt: null,
    ...overrides,
  };
}

interface PageAccess {
  aiPanelOpen: () => boolean;
  toggleAiPanel: () => void;
  onAiAccepted: (req: CreateAiQuestionRequest) => Promise<void>;
  isEdit: () => boolean;
  selected: () => QuizDetail | null;
  currentStep: () => 1 | 2 | 3;
  stepError: () => string[] | null;
  onContinueFromDatos: () => Promise<void>;
  onContinueFromPreguntas: () => void;
  goToStep: (s: 1 | 2 | 3) => void;
  metadataForm: {
    patchValue: (v: unknown) => void;
    controls: Record<string, { setValue: (v: unknown) => void }>;
  };
}

function access(p: QuizFormPageComponent): PageAccess {
  return p as unknown as PageAccess;
}

describe('QuizFormPageComponent — AI assistant panel integration (FE-7c.1)', () => {
  let fixture: ComponentFixture<QuizFormPageComponent>;
  let component: QuizFormPageComponent;
  let fakeStore: FakeQuizzesStore;
  let fakeAi: FakeAiAssistantService;
  let fakeAuth: FakeAuthService;

  async function mountEditMode(): Promise<void> {
    TestBed.configureTestingModule({
      imports: [QuizFormPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({}),
              paramMap: convertToParamMap({ uuid: 'q-1' }),
            },
          },
        },
        { provide: QuizzesStore, useValue: fakeStore },
        { provide: AiAssistantService, useValue: fakeAi },
        { provide: AuthService, useValue: fakeAuth },
      ],
    });
    fixture = TestBed.createComponent(QuizFormPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    fakeStore = new FakeQuizzesStore();
    fakeAi = new FakeAiAssistantService();
    fakeAuth = new FakeAuthService();
  });

  it('shows the "Sugerir con IA" button when the user has LMS_AI_GENERATE', async () => {
    fakeAuth.permissions.set([Permission.LmsAiGenerate]);
    await mountEditMode();
    // En edición sin preguntas arranca en paso 1; ir a preguntas para ver el AI toggle.
    access(component).goToStep(2);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector(
      '[data-testid="ai-toggle"]',
    ) as HTMLButtonElement | null;
    expect(btn).toBeTruthy();
    expect(btn?.textContent ?? '').toContain('Sugerir con IA');
  });

  it('does NOT show the AI button when the user lacks LMS_AI_GENERATE', async () => {
    fakeAuth.permissions.set([Permission.LmsQuizCreate]);
    await mountEditMode();
    access(component).goToStep(2);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector(
      '[data-testid="ai-toggle"]',
    ) as HTMLButtonElement | null;
    expect(btn).toBeNull();
  });

  it('toggles the AI panel open / closed when the button is clicked', async () => {
    fakeAuth.permissions.set([Permission.LmsAiGenerate]);
    await mountEditMode();
    access(component).goToStep(2);
    fixture.detectChanges();
    const a = access(component);
    expect(a.aiPanelOpen()).toBeFalse();
    a.toggleAiPanel();
    fixture.detectChanges();
    expect(a.aiPanelOpen()).toBeTrue();
    expect(fixture.nativeElement.querySelector('[data-testid="ai-panel-slot"]')).toBeTruthy();
    a.toggleAiPanel();
    fixture.detectChanges();
    expect(a.aiPanelOpen()).toBeFalse();
    expect(fixture.nativeElement.querySelector('[data-testid="ai-panel-slot"]')).toBeNull();
  });

  it('onAiAccepted maps an MC suggestion to CreateQuestionRequest with options + isCorrect', async () => {
    fakeAuth.permissions.set([Permission.LmsAiGenerate]);
    await mountEditMode();
    const a = access(component);
    const req: CreateAiQuestionRequest = {
      prompt: '¿Cuál es la capital de Francia?',
      type: 'MC',
      points: 5,
      options: [
        { label: 'París', isCorrect: true, explanation: 'es la capital' },
        { label: 'Londres', isCorrect: false, explanation: 'capital del RU' },
      ],
      aiRationale: 'Geography basic',
    };
    await a.onAiAccepted(req);
    expect(fakeStore.addQuestionCalls.length).toBe(1);
    const call = fakeStore.addQuestionCalls[0];
    expect(call.quizUuid).toBe('q-1');
    expect(call.req).toEqual({
      type: 'MC',
      prompt: '¿Cuál es la capital de Francia?',
      points: 5,
      options: [
        { label: 'París', isCorrect: true, explanation: 'es la capital' },
        { label: 'Londres', isCorrect: false, explanation: 'capital del RU' },
      ],
    });
  });

  it('onAiAccepted maps a TF suggestion to correctBoolean from the correct option label', async () => {
    fakeAuth.permissions.set([Permission.LmsAiGenerate]);
    await mountEditMode();
    const a = access(component);
    const req: CreateAiQuestionRequest = {
      prompt: 'Verdadero o falso: el agua hierve a 100°C al nivel del mar.',
      type: 'TF',
      points: 3,
      options: [
        { label: 'Verdadero', isCorrect: true, explanation: null },
        { label: 'Falso', isCorrect: false, explanation: null },
      ],
      aiRationale: 'Concepto físico elemental',
    };
    await a.onAiAccepted(req);
    const call = fakeStore.addQuestionCalls[0];
    expect(call.req).toEqual({
      type: 'TF',
      prompt: 'Verdadero o falso: el agua hierve a 100°C al nivel del mar.',
      points: 3,
      correctBoolean: true,
    });
  });

  it('onAiAccepted maps a SHORT_ANSWER suggestion to expectedKeywords from the rationale', async () => {
    fakeAuth.permissions.set([Permission.LmsAiGenerate]);
    await mountEditMode();
    const a = access(component);
    const req: CreateAiQuestionRequest = {
      prompt: '¿Qué es un mamífero?',
      type: 'SHORT_ANSWER',
      points: 5,
      options: [],
      aiRationale: 'vertebrado, mamífero, cordado',
    };
    await a.onAiAccepted(req);
    const call = fakeStore.addQuestionCalls[0];
    expect(call.req).toEqual({
      type: 'SHORT_ANSWER',
      prompt: '¿Qué es un mamífero?',
      points: 5,
      expectedKeywords: 'vertebrado, mamífero, cordado',
    });
  });

  it('onAiAccepted does not dispatch when there is no quiz loaded yet', async () => {
    fakeAuth.permissions.set([Permission.LmsAiGenerate]);
    TestBed.configureTestingModule({
      imports: [QuizFormPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}), paramMap: convertToParamMap({}) },
          },
        },
        { provide: QuizzesStore, useValue: fakeStore },
        { provide: AiAssistantService, useValue: fakeAi },
        { provide: AuthService, useValue: fakeAuth },
      ],
    });
    fixture = TestBed.createComponent(QuizFormPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    const a = access(component);
    await a.onAiAccepted({
      prompt: 'X',
      type: 'MC',
      points: 1,
      options: [],
      aiRationale: '',
    });
    expect(fakeStore.addQuestionCalls.length).toBe(0);
  });
});

describe('QuizFormPageComponent — stepper validation gates', () => {
  let fixture: ComponentFixture<QuizFormPageComponent>;
  let component: QuizFormPageComponent;
  let fakeStore: FakeQuizzesStore;
  let fakeAuth: FakeAuthService;

  async function mountCreateMode(): Promise<void> {
    TestBed.configureTestingModule({
      imports: [QuizFormPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                section: 's-1',
                assignment: 'a-1',
              }),
              paramMap: convertToParamMap({}),
            },
          },
        },
        { provide: QuizzesStore, useValue: fakeStore },
        { provide: AiAssistantService, useValue: new FakeAiAssistantService() },
        { provide: AuthService, useValue: fakeAuth },
      ],
    });
    fixture = TestBed.createComponent(QuizFormPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function mountEditWithQuestions(): Promise<void> {
    fakeStore.selected.set(
      makeDetail({
        questions: [makeQuestionRow(QuestionType.MultipleChoice)],
        questionCount: 1,
      }),
    );
    TestBed.configureTestingModule({
      imports: [QuizFormPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({}),
              paramMap: convertToParamMap({ uuid: 'q-1' }),
            },
          },
        },
        { provide: QuizzesStore, useValue: fakeStore },
        { provide: AiAssistantService, useValue: new FakeAiAssistantService() },
        { provide: AuthService, useValue: fakeAuth },
      ],
    });
    fixture = TestBed.createComponent(QuizFormPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    fakeStore = new FakeQuizzesStore();
    fakeAuth = new FakeAuthService();
    fakeAuth.permissions.set([Permission.LmsQuizCreate]);
  });

  it('Continuar con título vacío → sigue en paso 1 y muestra errores', async () => {
    await mountCreateMode();
    const a = access(component);
    expect(a.currentStep()).toBe(1);
    a.metadataForm.patchValue({ title: null });
    await a.onContinueFromDatos();
    fixture.detectChanges();
    expect(a.currentStep()).toBe(1);
    expect(a.stepError()).toBeTruthy();
    expect(a.stepError()!.some((m) => /Título/i.test(m))).toBeTrue();
    expect(fixture.nativeElement.querySelector('[data-testid="step-error"]')).toBeTruthy();
    expect(fakeStore.createQuizCalls.length).toBe(0);
  });

  it('Continuar con metadata válida → crea borrador y pasa a paso 2', async () => {
    await mountCreateMode();
    const a = access(component);
    a.metadataForm.patchValue({
      title: 'Fracciones',
      maxAttempts: 1,
      maxScore: 20,
    });
    await a.onContinueFromDatos();
    fixture.detectChanges();
    expect(fakeStore.createQuizCalls.length).toBe(1);
    expect(a.currentStep()).toBe(2);
    expect(a.stepError()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="step-panel-2"]')).toBeTruthy();
  });

  it('Siguiente sin preguntas → no pasa a paso 3', async () => {
    await mountCreateMode();
    const a = access(component);
    a.metadataForm.patchValue({ title: 'X', maxAttempts: 1, maxScore: 100 });
    await a.onContinueFromDatos();
    fixture.detectChanges();
    expect(a.currentStep()).toBe(2);
    a.onContinueFromPreguntas();
    fixture.detectChanges();
    expect(a.currentStep()).toBe(2);
    expect(a.stepError()!.join(' ')).toContain('al menos una pregunta');
  });

  it('Con ≥1 pregunta → Siguiente pasa a paso 3', async () => {
    await mountEditWithQuestions();
    const a = access(component);
    // Edit con preguntas abre en paso 2
    expect(a.currentStep()).toBe(2);
    a.onContinueFromPreguntas();
    fixture.detectChanges();
    expect(a.currentStep()).toBe(3);
    expect(fixture.nativeElement.querySelector('[data-testid="step-panel-3"]')).toBeTruthy();
  });
});
