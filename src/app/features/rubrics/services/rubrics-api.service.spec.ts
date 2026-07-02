import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RubricsApiService } from './rubrics-api.service';
import { ApiService } from '@core/services';

describe('RubricsApiService', () => {
  let service: RubricsApiService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'put', 'delete']);
    TestBed.configureTestingModule({
      providers: [RubricsApiService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(RubricsApiService);
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  describe('listRubrics', () => {
    it('obtiene listado', (done) => {
      apiSpy.get.and.returnValue(of([]));
      service.listRubrics().subscribe((rows) => {
        expect(rows).toEqual([]);
        done();
      });
    });

    it('pasa filtros como params', (done) => {
      apiSpy.get.and.returnValue(of([]));
      service.listRubrics({ systemOnly: true, isActive: true, q: 'test' }).subscribe(() => {
        expect(apiSpy.get).toHaveBeenCalledWith(jasmine.any(String), {
          systemOnly: 'true',
          isActive: 'true',
          q: 'test',
        });
        done();
      });
    });
  });

  describe('listSystemRubrics', () => {
    it('obtiene rúbricas del sistema', (done) => {
      apiSpy.get.and.returnValue(of([]));
      service.listSystemRubrics().subscribe((rows) => {
        expect(rows).toEqual([]);
        done();
      });
    });
  });

  describe('getRubric', () => {
    it('obtiene detalle por UUID', (done) => {
      const mockRaw = {
        data: {
          publicUuid: 'r1',
          name: 'Test',
          description: null,
          criteria: [],
          levels: [],
          isSystem: false,
          parentRubricPublicUuid: null,
          isActive: true,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      };
      apiSpy.get.and.returnValue(of(mockRaw));
      service.getRubric('r1').subscribe((detail) => {
        expect(detail.name).toBe('Test');
        done();
      });
    });
  });

  describe('createRubric', () => {
    it('crea rúbrica', (done) => {
      const mockRaw = {
        data: {
          publicUuid: 'r2',
          name: 'Nueva',
          description: null,
          criteria: [],
          levels: [],
          isSystem: false,
          parentRubricPublicUuid: null,
          isActive: true,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      };
      const request = { name: 'Nueva', criteria: [], levels: [] };
      apiSpy.post.and.returnValue(of(mockRaw));
      service.createRubric(request).subscribe((detail) => {
        expect(detail.name).toBe('Nueva');
        done();
      });
    });
  });

  describe('forkRubric', () => {
    it('forkea rúbrica existente', (done) => {
      const mockRaw = {
        data: {
          publicUuid: 'r3',
          name: 'Fork',
          description: null,
          criteria: [],
          levels: [],
          isSystem: false,
          parentRubricPublicUuid: 'r1',
          isActive: true,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      };
      apiSpy.post.and.returnValue(of(mockRaw));
      service.forkRubric('r1').subscribe((detail) => {
        expect(detail.parentRubricPublicUuid).toBe('r1');
        done();
      });
    });
  });

  describe('updateRubric', () => {
    it('actualiza rúbrica', (done) => {
      const mockRaw = {
        data: {
          publicUuid: 'r1',
          name: 'Actualizada',
          description: null,
          criteria: [],
          levels: [],
          isSystem: false,
          parentRubricPublicUuid: null,
          isActive: true,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      };
      apiSpy.put.and.returnValue(of(mockRaw));
      service.updateRubric('r1', { name: 'Actualizada' }).subscribe((detail) => {
        expect(detail.name).toBe('Actualizada');
        done();
      });
    });
  });

  describe('deleteRubric', () => {
    it('elimina rúbrica', (done) => {
      apiSpy.delete.and.returnValue(of(undefined));
      service.deleteRubric('r1').subscribe(() => {
        expect(apiSpy.delete).toHaveBeenCalled();
        done();
      });
    });
  });
});
