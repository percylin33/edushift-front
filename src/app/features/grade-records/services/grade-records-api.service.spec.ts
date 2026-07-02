import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { GradeRecordsApiService } from './grade-records-api.service';
import { ApiService } from '@core/services';

describe('GradeRecordsApiService', () => {
  let service: GradeRecordsApiService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'put', 'delete']);
    TestBed.configureTestingModule({
      providers: [GradeRecordsApiService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(GradeRecordsApiService);
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  describe('listByEvaluation', () => {
    it('obtiene grade records por evaluation', (done) => {
      apiSpy.get.and.returnValue(of([]));
      service.listByEvaluation('e1').subscribe((rows) => {
        expect(rows).toEqual([]);
        done();
      });
    });
  });

  describe('upsertGrade', () => {
    it('crea/actualiza un grade record', (done) => {
      const mockRaw = {
        data: {
          publicUuid: 'gr1',
          evaluation: { publicUuid: 'e1', name: 'Ex', scale: 'SCORE_0_20', status: 'DRAFT' },
          student: { publicUuid: 's1', firstName: 'A', lastName: 'B', secondLastName: null },
          score: '15',
          literal: null,
          comments: null,
          recordedAt: null,
          recordedByUserId: null,
          isActive: true,
          createdAt: '',
          updatedAt: '',
        },
      };
      apiSpy.post.and.returnValue(of(mockRaw));
      service.upsertGrade('e1', { studentPublicUuid: 's1', score: 15 }).subscribe((detail) => {
        expect(detail.score).toBe(15);
        done();
      });
    });
  });

  describe('bulkUpsert', () => {
    it('envía bulk upsert', (done) => {
      const mockRaw = {
        data: { requested: 2, created: 2, updated: 0, records: [] },
      };
      apiSpy.post.and.returnValue(of(mockRaw));
      service
        .bulkUpsert('e1', { records: [{ studentPublicUuid: 's1', score: 15 }] })
        .subscribe((summary) => {
          expect(summary.requested).toBe(2);
          done();
        });
    });
  });

  describe('getGrade', () => {
    it('obtiene grade record por UUID', (done) => {
      const mockRaw = {
        data: {
          publicUuid: 'gr1',
          evaluation: { publicUuid: 'e1', name: 'Ex', scale: 'SCORE_0_20', status: 'DRAFT' },
          student: { publicUuid: 's1', firstName: 'A', lastName: 'B', secondLastName: null },
          score: '18',
          literal: null,
          comments: null,
          recordedAt: null,
          recordedByUserId: null,
          isActive: true,
          createdAt: '',
          updatedAt: '',
        },
      };
      apiSpy.get.and.returnValue(of(mockRaw));
      service.getGrade('gr1').subscribe((detail) => {
        expect(detail.score).toBe(18);
        done();
      });
    });
  });

  describe('updateGrade', () => {
    it('actualiza grade record', (done) => {
      const mockRaw = {
        data: {
          publicUuid: 'gr1',
          evaluation: { publicUuid: 'e1', name: 'Ex', scale: 'SCORE_0_20', status: 'DRAFT' },
          student: { publicUuid: 's1', firstName: 'A', lastName: 'B', secondLastName: null },
          score: '19',
          literal: null,
          comments: null,
          recordedAt: null,
          recordedByUserId: null,
          isActive: true,
          createdAt: '',
          updatedAt: '',
        },
      };
      apiSpy.put.and.returnValue(of(mockRaw));
      service.updateGrade('gr1', { score: 19 }).subscribe((detail) => {
        expect(detail.score).toBe(19);
        done();
      });
    });
  });

  describe('deleteGrade', () => {
    it('elimina grade record', (done) => {
      apiSpy.delete.and.returnValue(of(undefined));
      service.deleteGrade('gr1').subscribe(() => {
        expect(apiSpy.delete).toHaveBeenCalled();
        done();
      });
    });
  });
});
