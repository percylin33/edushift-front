import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  RubricGeneratorService,
  RubricGeneratorRequest,
  RubricDraft,
} from './rubric-generator.service';
import { ApiService } from '@core/services/api.service';

describe('RubricGeneratorService', () => {
  let service: RubricGeneratorService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const validRequest: RubricGeneratorRequest = {
    courseName: 'Historia',
    criteria: ['Análisis', 'Síntesis'],
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['post']);
    TestBed.configureTestingModule({
      providers: [RubricGeneratorService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(RubricGeneratorService);
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  describe('generate', () => {
    it('genera borrador exitosamente', (done) => {
      const draft: RubricDraft = { title: 'Rúbrica', criteria: [], currency: 'PEN' };
      apiSpy.post.and.returnValue(of({ success: true, data: draft }));
      service.generate(validRequest).subscribe((d) => {
        expect(d.title).toBe('Rúbrica');
        done();
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

    it('lanza error si criteria está vacío', (done) => {
      service.generate({ ...validRequest, criteria: [] }).subscribe({
        error: (err) => {
          expect(err.code).toBe('AI_CRITERIA_REQUIRED');
          done();
        },
      });
    });

    it('lanza error si respuesta es vacía', (done) => {
      apiSpy.post.and.returnValue(of({ success: false, data: null }));
      service.generate(validRequest).subscribe({
        error: (err) => {
          expect(err.code).toBe('AI_EMPTY_RESPONSE');
          done();
        },
      });
    });

    it('incluye seedRubricId en request', (done) => {
      const draft: RubricDraft = { title: 'Rúbrica', criteria: [] };
      apiSpy.post.and.returnValue(of({ success: true, data: draft }));
      service.generate({ ...validRequest, seedRubricId: 'r1' }).subscribe(() => {
        expect(apiSpy.post).toHaveBeenCalledWith(
          jasmine.any(String),
          jasmine.objectContaining({ seedRubricId: 'r1' }),
        );
        done();
      });
    });
  });
});
