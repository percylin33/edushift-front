import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { of, throwError } from 'rxjs';
import { QuizFormPageComponent } from './quiz-form.page';
import { QuizzesStore } from '../../store/quizzes.store';
import { AiAssistantService } from '../../services/ai-assistant.service';
import { AuthService } from '@core/services/auth.service';
import { Permission } from '@core/enums';
import { QuestionType, QuestionRow } from '../../models/quiz.model';
import { CreateAiQuestionRequest } from '../../models/ai-assistant.model';

/**
 * Mocks a QuizStore con spies para `addQuestion` y `loadDetail`.
 * Devuelve un QuizDetail con la pregunta recién agregada (refetch simulado).
 */
class FakeQuizzesStore {
  // Signals públicas (read-only para los consumidores).
  readonly selected = signal<ReturnType<typeof makeDetail> | null>(null);
  readonly loadingDetail = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  addQuestionCalls: Array<{ quizUuid: string; req: unknown }> = [];
  addQuestionResult: QuestionRow | 'ERROR' = makeQuestionRow(QuestionType.MultipleChoice);
  loadDetailCalls: string[] = [];

  async addQuestion(quizUuid: string, req: unknown): Promise<QuestionRow | null> {
    this.addQuestionCalls.push({ quizUuid, req });
    if (this.addQuestionResult === 'ERROR') return null;
    // Refetch simulado: append la question al detail.
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

  async loadDetail(quizUuid: string): Promise<ReturnType<typeof makeDetail> | null> {
    this.loadDetailCalls.push(quizUuid);
    if (!this.selected()) this.selected.set(makeDetail());
    return this.selected();
  }
}

/** Test double del AiAssistantService (consume el panel, no HTTP). */
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

/** Test double de AuthService que expone un signal mutable de permissions. */
class FakeAuthService {
  readonly permissions = signal<Permission[]>([]);
  // Otros consumers podrían leer estos, pero para el spec solo importan los
  // permissions. Mantenemos el resto como stubs.
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

function makeDetail() {
  return {
    publicUuid: 'q-1',
    sectionPublicUuid: 's-1',
    title: 'Quiz 1',
    description: null,
    status: 'DRAFT' as const,
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
    questions: [] as QuestionRow[],
    createdAt: new Date(),
    updatedAt: null,
  };
}

interface PageAccess {
  aiPanelOpen: () => boolean;
  toggleAiPanel: () => void;
  onAiAccepted: (req: CreateAiQuestionRequest) => Promise<void>;
  isEdit: () => boolean;
  selected: () => ReturnType<typeof makeDetail> | null;
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

  /** Mount the page in EDIT mode (with `quizUuid` param) and wait for
   *  the loadDetail promise to resolve. */
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
    // Espera a que `loadDetail` (llamado en `ngOnInit`) termine.
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    fakeStore = new FakeQuizzesStore();
    fakeAi = new FakeAiAssistantService();
    fakeAuth = new FakeAuthService();
  });

  // ---------------------------------------------------------------------------
  // Permission gate
  // ---------------------------------------------------------------------------

  it('shows the "Sugerir con IA" button when the user has LMS_AI_GENERATE', async () => {
    fakeAuth.permissions.set([Permission.LmsAiGenerate]);
    await mountEditMode();
    const btn = fixture.nativeElement.querySelector(
      '[data-testid="ai-toggle"]',
    ) as HTMLButtonElement | null;
    expect(btn).toBeTruthy();
    expect(btn?.textContent ?? '').toContain('Sugerir con IA');
  });

  it('does NOT show the AI button when the user lacks LMS_AI_GENERATE', async () => {
    fakeAuth.permissions.set([Permission.LmsQuizCreate]); // sin LmsAiGenerate
    await mountEditMode();
    const btn = fixture.nativeElement.querySelector(
      '[data-testid="ai-toggle"]',
    ) as HTMLButtonElement | null;
    expect(btn).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Toggle + onAiAccepted
  // ---------------------------------------------------------------------------

  it('toggles the AI panel open / closed when the button is clicked', async () => {
    fakeAuth.permissions.set([Permission.LmsAiGenerate]);
    await mountEditMode();
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
    // No montamos en edit mode → no hay quizUuid → addQuestion NO debe llamarse.
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
