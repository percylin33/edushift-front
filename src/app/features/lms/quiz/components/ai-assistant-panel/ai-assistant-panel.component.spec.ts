import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { AiAssistantPanelComponent } from './ai-assistant-panel.component';
import { AiAssistantService } from '../../services/ai-assistant.service';
import {
  AiAssistantRequest,
  AiAssistantStatus,
  QuestionSuggestion
} from '../../models/ai-assistant.model';

interface PanelAccess {
  state: () => { status: AiAssistantStatus; suggestions: QuestionSuggestion[]; error: string | null };
  topicControl: { setValue: (v: string) => void };
  countControl: { setValue: (v: number) => void };
  accept: { subscribe: (cb: (req: unknown) => void) => { unsubscribe: () => void } };
  onGenerate: () => Promise<void>;
  onAccept: (s: QuestionSuggestion) => void;
  onDiscard: (id: string) => void;
  onEditPrompt: (id: string, prompt: string) => void;
}

function access(c: AiAssistantPanelComponent): PanelAccess {
  return c as unknown as PanelAccess;
}

/**
 * Test double for {@link AiAssistantService}. The component depends on
 * the service via DI; we override the provider with this fake so the
 * test exercises the component's state machine and not the HTTP layer
 * (the HTTP layer has its own spec, see `ai-assistant.service.spec.ts`).
 */
class FakeAiAssistantService {
  /** If set, `suggest` rejects with this error. */
  failNext: { code: string; message: string } | null = null;
  /** The list of suggestions to return. Defaults to a 2-item bank. */
  nextSuggestions: QuestionSuggestion[] = [
    {
      id: 'sug-test-1',
      prompt: 'Pregunta de prueba 1',
      questionType: 'MC',
      points: 5,
      options: [
        { label: 'A', isCorrect: true, explanation: 'es A' },
        { label: 'B', isCorrect: false, explanation: null }
      ],
      rationale: 'Rationale 1'
    },
    {
      id: 'sug-test-2',
      prompt: 'Pregunta de prueba 2',
      questionType: 'TF',
      points: 3,
      options: [
        { label: 'Verdadero', isCorrect: true, explanation: null },
        { label: 'Falso', isCorrect: false, explanation: null }
      ],
      rationale: 'Rationale 2'
    }
  ];

  suggest(_req: AiAssistantRequest): Observable<QuestionSuggestion[]> {
    if (this.failNext) {
      const err = this.failNext;
      this.failNext = null;
      return throwError(() => err);
    }
    return of(this.nextSuggestions);
  }

  // Unused by the panel but kept to satisfy the type.
  statusLabel(_status: AiAssistantStatus): string {
    return '';
  }
}

describe('AiAssistantPanelComponent (FE-7c.1 — wired against FakeAiAssistantService)', () => {
  let fixture: ComponentFixture<AiAssistantPanelComponent>;
  let component: AiAssistantPanelComponent;
  let fakeService: FakeAiAssistantService;

  beforeEach(() => {
    fakeService = new FakeAiAssistantService();
    TestBed.configureTestingModule({
      imports: [AiAssistantPanelComponent],
      providers: [{ provide: AiAssistantService, useValue: fakeService }]
    });
    fixture = TestBed.createComponent(AiAssistantPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts in the Idle state with no suggestions', () => {
    expect(access(component).state().status).toBe(AiAssistantStatus.Idle);
    expect(access(component).state().suggestions.length).toBe(0);
    expect(access(component).state().error).toBeNull();
  });

  it('renders the empty state when there are no suggestions', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-empty-state')).toBeTruthy();
  });

  it('shows an inline error when the topic is too short (no service call)', async () => {
    const a = access(component);
    a.topicControl.setValue('a');
    await a.onGenerate();
    expect(a.state().status).toBe(AiAssistantStatus.Error);
    expect(a.state().error).toContain('2 caracteres');
  });

  it('moves to Loading then Success when the service returns suggestions', async () => {
    const a = access(component);
    a.topicControl.setValue('capitales');
    a.countControl.setValue(2);
    const p = a.onGenerate();
    expect(a.state().status).toBe(AiAssistantStatus.Loading);
    await p;
    expect(a.state().status).toBe(AiAssistantStatus.Success);
    expect(a.state().suggestions.length).toBe(2);
  });

  it('maps a service error to the Error state with the message from the service', async () => {
    const a = access(component);
    fakeService.failNext = { code: 'AI_QUOTA_EXCEEDED', message: 'Has alcanzado la cuota' };
    a.topicControl.setValue('capitales');
    a.countControl.setValue(1);
    await a.onGenerate();
    expect(a.state().status).toBe(AiAssistantStatus.Error);
    expect(a.state().error).toContain('cuota');
    expect(a.state().suggestions.length).toBe(0);
  });

  it('emits a CreateAiQuestionRequest when a suggestion is accepted', async () => {
    const a = access(component);
    a.topicControl.setValue('capitales');
    a.countControl.setValue(2);
    const emitted: unknown[] = [];
    a.accept.subscribe((req) => emitted.push(req));
    await a.onGenerate();
    expect(a.state().suggestions.length).toBeGreaterThan(0);
    const first = a.state().suggestions[0];
    a.onAccept(first);
    expect(emitted.length).toBe(1);
    const req = emitted[0] as { prompt: string; type: string; points: number; options: unknown[]; aiRationale: string };
    expect(req.prompt).toBe(first.prompt);
    expect(req.type).toBe(first.questionType);
    expect(req.points).toBe(first.points);
    expect(req.options.length).toBe(first.options.length);
    expect(req.aiRationale).toBe(first.rationale);
  });

  it('removes the accepted suggestion from the list', async () => {
    const a = access(component);
    a.topicControl.setValue('capitales');
    a.countControl.setValue(2);
    await a.onGenerate();
    const before = a.state().suggestions.length;
    expect(before).toBeGreaterThan(0);
    const first = a.state().suggestions[0];
    a.onAccept(first);
    expect(a.state().suggestions.length).toBe(before - 1);
  });

  it('discards a suggestion without emitting accept', async () => {
    const a = access(component);
    a.topicControl.setValue('capitales');
    a.countControl.setValue(2);
    const emitted: unknown[] = [];
    a.accept.subscribe((req) => emitted.push(req));
    await a.onGenerate();
    const before = a.state().suggestions.length;
    const first = a.state().suggestions[0];
    a.onDiscard(first.id);
    expect(a.state().suggestions.length).toBe(before - 1);
    expect(emitted.length).toBe(0);
  });

  it('edits a suggestion prompt in-place', async () => {
    const a = access(component);
    a.topicControl.setValue('capitales');
    a.countControl.setValue(1);
    await a.onGenerate();
    const first = a.state().suggestions[0];
    a.onEditPrompt(first.id, 'Pregunta editada');
    const updated = a.state().suggestions.find((s) => s.id === first.id);
    expect(updated?.prompt).toBe('Pregunta editada');
  });
});
