import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  SessionGeneratorService,
  SessionGeneratorRequest,
  SessionDraft,
} from './session-generator.service';
import { ApiService } from '@core/services/api.service';

describe('SessionGeneratorService', () => {
  let service: SessionGeneratorService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const validRequest: SessionGeneratorRequest = {
    topic: 'Revolución Francesa',
    courseName: 'Historia',
    gradeName: '5to secundaria',
    durationMinutes: 45,
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['post']);
    TestBed.configureTestingModule({
      providers: [SessionGeneratorService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(SessionGeneratorService);
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  describe('generate', () => {
    it('genera borrador exitosamente', (done) => {
      const draft: SessionDraft = {
        title: 'Clase',
        activities: [],
        resources: [],
        evaluationCriteria: [],
      };
      apiSpy.post.and.returnValue(of({ success: true, data: draft }));
      service.generate(validRequest).subscribe((d) => {
        expect(d.title).toBe('Clase');
        done();
      });
    });

    it('lanza error si topic es muy corto', (done) => {
      service.generate({ ...validRequest, topic: 'ab' }).subscribe({
        error: (err) => {
          expect(err.code).toBe('AI_TOPIC_REQUIRED');
          done();
        },
      });
    });

    it('lanza error si falta courseName', (done) => {
      service.generate({ ...validRequest, courseName: '' }).subscribe({
        error: (err) => {
          expect(err.code).toBe('AI_COURSE_REQUIRED');
          done();
        },
      });
    });

    it('lanza error si falta gradeName', (done) => {
      service.generate({ ...validRequest, gradeName: '' }).subscribe({
        error: (err) => {
          expect(err.code).toBe('AI_GRADE_REQUIRED');
          done();
        },
      });
    });

    it('lanza error si durationMinutes fuera de rango', (done) => {
      service.generate({ ...validRequest, durationMinutes: 5 }).subscribe({
        error: (err) => {
          expect(err.code).toBe('AI_DURATION_OUT_OF_RANGE');
          done();
        },
      });
    });

    it('lanza error si respuesta del backend es vacía', (done) => {
      apiSpy.post.and.returnValue(of({ success: false, data: null }));
      service.generate(validRequest).subscribe({
        error: (err) => {
          expect(err.code).toBe('AI_EMPTY_RESPONSE');
          done();
        },
      });
    });
  });
});
