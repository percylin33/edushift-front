import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { AiAssistantService } from './ai-assistant.service';
import { AiAssistantStatus } from '../models/ai-assistant.model';
import { API } from '@core/constants/api.constants';
import { ApiService } from '@core/services/api.service';

describe('AiAssistantService (FE-7c.1 — wired against BE-7c.1)', () => {
  let service: AiAssistantService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ApiService],
    });
    service = TestBed.inject(AiAssistantService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  // ---------------------------------------------------------------------------
  // Pre-flight validation (no HTTP call).
  // ---------------------------------------------------------------------------

  it('rejects empty topics with AI_TOPIC_REQUIRED (no HTTP call)', async () => {
    const errP = firstValueFrom(service.suggest({ topic: '', count: 3 }).pipe(take(1)));
    let caught: { code: string; message: string } | null = null;
    try {
      await errP;
    } catch (e) {
      caught = e as { code: string; message: string };
    }
    expect(caught?.code).toBe('AI_TOPIC_REQUIRED');
    http.expectNone(API.LMS.AI_SUGGEST_QUESTIONS);
  });

  it('rejects whitespace-only topics with AI_TOPIC_REQUIRED', async () => {
    let caught: { code: string } | null = null;
    try {
      await firstValueFrom(service.suggest({ topic: '   ', count: 3 }).pipe(take(1)));
    } catch (e) {
      caught = e as { code: string };
    }
    expect(caught?.code).toBe('AI_TOPIC_REQUIRED');
    http.expectNone(API.LMS.AI_SUGGEST_QUESTIONS);
  });

  it('rejects count < 1 with AI_COUNT_OUT_OF_RANGE', async () => {
    let caught: { code: string } | null = null;
    try {
      await firstValueFrom(service.suggest({ topic: 'fracciones', count: 0 }).pipe(take(1)));
    } catch (e) {
      caught = e as { code: string };
    }
    expect(caught?.code).toBe('AI_COUNT_OUT_OF_RANGE');
    http.expectNone(API.LMS.AI_SUGGEST_QUESTIONS);
  });

  it('rejects count > 10 with AI_COUNT_OUT_OF_RANGE', async () => {
    let caught: { code: string } | null = null;
    try {
      await firstValueFrom(service.suggest({ topic: 'fracciones', count: 11 }).pipe(take(1)));
    } catch (e) {
      caught = e as { code: string };
    }
    expect(caught?.code).toBe('AI_COUNT_OUT_OF_RANGE');
  });

  // ---------------------------------------------------------------------------
  // Happy path: BE returns 200 + ApiResponse with questions[].
  // ---------------------------------------------------------------------------

  it('POSTs the request body and unwraps the ApiResponse envelope (happy path)', async () => {
    const promise = firstValueFrom(
      service.suggest({ topic: 'Suma de fracciones', count: 2, questionType: 'MC' }).pipe(take(1)),
    );
    const req = http.expectOne(API.LMS.AI_SUGGEST_QUESTIONS);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      topic: 'Suma de fracciones',
      count: 2,
      questionType: 'MC',
    });
    req.flush({
      success: true,
      data: {
        questions: [
          {
            id: 'q-1',
            prompt: '¿Cuánto es 1/2 + 1/4?',
            questionType: 'MC',
            points: 5,
            options: [
              { label: '3/4', isCorrect: true, explanation: '1/2=2/4; 2/4+1/4=3/4' },
              { label: '1/3', isCorrect: false, explanation: null },
            ],
            rationale: 'Suma de fracciones con denominador común.',
          },
        ],
        model: 'mock-llm',
        provider: 'mock',
        promptVersion: 'v1',
        generationUuids: ['gen-1'],
      },
    });
    const list = await promise;
    expect(list.length).toBe(1);
    expect(list[0].id).toBe('q-1');
    expect(list[0].questionType).toBe('MC');
    expect(list[0].options.some((o) => o.isCorrect)).toBeTrue();
    expect(list[0].rationale).toContain('denominador común');
  });

  it('omits questionType from the body when not provided', async () => {
    const promise = firstValueFrom(service.suggest({ topic: 'Capitales', count: 3 }).pipe(take(1)));
    const req = http.expectOne(API.LMS.AI_SUGGEST_QUESTIONS);
    expect(req.request.body).toEqual({
      topic: 'Capitales',
      count: 3,
      questionType: null,
    });
    req.flush({
      success: true,
      data: { questions: [], model: 'm', provider: 'p', promptVersion: 'v1', generationUuids: [] },
    });
    const list = await promise;
    expect(list).toEqual([]);
  });

  it('treats envelope.success=false as an error', async () => {
    let caught: { code: string } | null = null;
    const promise = firstValueFrom(service.suggest({ topic: 'Capitals', count: 1 }).pipe(take(1)));
    const req = http.expectOne(API.LMS.AI_SUGGEST_QUESTIONS);
    req.flush({ success: false, data: null });
    try {
      await promise;
    } catch (e) {
      caught = e as { code: string };
    }
    expect(caught?.code).toBe('AI_EMPTY_RESPONSE');
  });

  // ---------------------------------------------------------------------------
  // Error mapping (HTTP status → panel-friendly code + Spanish message).
  // ---------------------------------------------------------------------------

  it('maps 403 AI_DISABLED to the Spanish copy "La IA está deshabilitada…"', async () => {
    let caught: { code: string; message: string } | null = null;
    const promise = firstValueFrom(service.suggest({ topic: 'XY', count: 1 }).pipe(take(1)));
    const req = http.expectOne(API.LMS.AI_SUGGEST_QUESTIONS);
    req.flush({ error: { code: 'AI_DISABLED' } }, { status: 403, statusText: 'Forbidden' });
    try {
      await promise;
    } catch (e) {
      caught = e as { code: string; message: string };
    }
    expect(caught?.code).toBe('AI_DISABLED');
    expect(caught?.message).toContain('deshabilitada');
  });

  it('maps 403 ACCESS_DENIED (no LMS_AI_GENERATE) to the "no tienes permiso" copy', async () => {
    let caught: { code: string; message: string } | null = null;
    const promise = firstValueFrom(service.suggest({ topic: 'XY', count: 1 }).pipe(take(1)));
    const req = http.expectOne(API.LMS.AI_SUGGEST_QUESTIONS);
    req.flush({ error: { code: 'ACCESS_DENIED' } }, { status: 403, statusText: 'Forbidden' });
    try {
      await promise;
    } catch (e) {
      caught = e as { code: string; message: string };
    }
    expect(caught?.code).toBe('ACCESS_DENIED');
    expect(caught?.message).toContain('No tienes permiso');
  });

  it('maps 429 AI_QUOTA_EXCEEDED to the "alcanzado la cuota" copy', async () => {
    let caught: { code: string; message: string } | null = null;
    const promise = firstValueFrom(service.suggest({ topic: 'XY', count: 1 }).pipe(take(1)));
    const req = http.expectOne(API.LMS.AI_SUGGEST_QUESTIONS);
    req.flush(
      { error: { code: 'AI_QUOTA_EXCEEDED' } },
      { status: 429, statusText: 'Too Many Requests' },
    );
    try {
      await promise;
    } catch (e) {
      caught = e as { code: string; message: string };
    }
    expect(caught?.code).toBe('AI_QUOTA_EXCEEDED');
    expect(caught?.message).toContain('cuota');
  });

  it('maps 502 AI_PARSE_ERROR to a Spanish "tuvo un problema" message', async () => {
    let caught: { code: string; message: string } | null = null;
    const promise = firstValueFrom(service.suggest({ topic: 'XY', count: 1 }).pipe(take(1)));
    const req = http.expectOne(API.LMS.AI_SUGGEST_QUESTIONS);
    req.flush({ error: { code: 'AI_PARSE_ERROR' } }, { status: 502, statusText: 'Bad Gateway' });
    try {
      await promise;
    } catch (e) {
      caught = e as { code: string; message: string };
    }
    expect(caught?.code).toBe('AI_PARSE_ERROR');
    expect(caught?.message).toContain('problema');
  });

  it('maps network error (status 0) to a "sin conexión" message', async () => {
    let caught: { code: string; message: string } | null = null;
    const promise = firstValueFrom(service.suggest({ topic: 'XY', count: 1 }).pipe(take(1)));
    const req = http.expectOne(API.LMS.AI_SUGGEST_QUESTIONS);
    req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    try {
      await promise;
    } catch (e) {
      caught = e as { code: string; message: string };
    }
    expect(caught?.code).toBe('AI_UNKNOWN');
    expect(caught?.message).toContain('Sin conexión');
  });
});

describe('AiAssistantService.statusLabel', () => {
  it('returns Spanish labels for each status', () => {
    // statusLabel is a pure function; no TestBed needed.
    const fn = AiAssistantService.prototype.statusLabel;
    expect(fn.call(null, AiAssistantStatus.Idle)).toBe('Listo');
    expect(fn.call(null, AiAssistantStatus.Loading)).toContain('Generando');
    expect(fn.call(null, AiAssistantStatus.Success)).toContain('listas');
    expect(fn.call(null, AiAssistantStatus.Error)).toContain('Error');
  });
});
