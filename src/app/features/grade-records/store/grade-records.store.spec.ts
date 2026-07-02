import { TestBed } from '@angular/core/testing';
import { GradeRecordsStore } from './grade-records.store';
import { GradeRecordsApiService } from '../services';
import { of, throwError } from 'rxjs';

describe('GradeRecordsStore', () => {
  let store: GradeRecordsStore;
  let apiSpy: jasmine.SpyObj<GradeRecordsApiService>;

  const mockRow = {
    publicUuid: 'gr1',
    studentPublicUuid: 's1',
    studentFullName: 'Pérez, Juan',
    studentFirstName: 'Juan',
    studentLastName: 'Pérez',
    score: 15,
    literal: null,
    comments: 'Bien',
    recordedAt: new Date(),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDetail = {
    ...mockRow,
    evaluation: { publicUuid: 'e1', name: 'Ex', scale: 'SCORE_0_20', status: 'DRAFT' },
    recordedByUserId: null,
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('GradeRecordsApiService', [
      'listByEvaluation',
      'upsertGrade',
      'updateGrade',
      'bulkUpsert',
      'deleteGrade',
    ]);
    TestBed.configureTestingModule({
      providers: [GradeRecordsStore, { provide: GradeRecordsApiService, useValue: apiSpy }],
    });
    store = TestBed.inject(GradeRecordsStore);
  });

  it('inicia con estado vacío', () => {
    expect(store.rows()).toEqual([]);
    expect(store.loading()).toBeFalse();
    expect(store.error()).toBeNull();
    expect(store.saving()).toBeFalse();
    expect(store.lastBulk()).toBeNull();
    expect(store.currentEvaluationUuid()).toBeNull();
    expect(store.hasRows()).toBeFalse();
    expect(store.isEmpty()).toBeTrue();
  });

  describe('counts', () => {
    it('calcula conteos', () => {
      store['_rows'].set([mockRow, { ...mockRow, isActive: false }]);
      const c = store.counts();
      expect(c.total).toBe(2);
      expect(c.active).toBe(1);
    });
  });

  describe('loadByEvaluation', () => {
    it('carga rows por evaluation', async () => {
      apiSpy.listByEvaluation.and.returnValue(of([mockRow]));
      await store.loadByEvaluation('e1');
      expect(store.rows().length).toBe(1);
      expect(store.currentEvaluationUuid()).toBe('e1');
    });

    it('maneja error', async () => {
      apiSpy.listByEvaluation.and.returnValue(throwError(() => new Error('Fail')));
      await store.loadByEvaluation('e1');
      expect(store.rows()).toEqual([]);
      expect(store.error()).toBeTruthy();
    });
  });

  describe('setFilters / clearFilters', () => {
    it('establece filtros', async () => {
      apiSpy.listByEvaluation.and.returnValue(of([]));
      store['_currentEvaluationUuid'].set('e1');
      await store.setFilters({ isActive: true });
      expect(store.filters().isActive).toBeTrue();
    });

    it('limpia filtros', async () => {
      apiSpy.listByEvaluation.and.returnValue(of([]));
      store['_currentEvaluationUuid'].set('e1');
      await store.clearFilters();
      expect(store.filters()).toEqual({});
    });
  });

  describe('upsert', () => {
    it('crea/actualiza y actualiza rows', async () => {
      apiSpy.upsertGrade.and.returnValue(of(mockDetail));
      store['_rows'].set([]);
      const result = await store.upsert('e1', { studentPublicUuid: 's1', score: 15 });
      expect(result).toBeTruthy();
      expect(store.hasRows()).toBeTrue();
    });

    it('maneja error', async () => {
      apiSpy.upsertGrade.and.returnValue(throwError(() => new Error('Fail')));
      const result = await store.upsert('e1', { studentPublicUuid: 's1', score: 15 });
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('actualiza grade record', async () => {
      apiSpy.updateGrade.and.returnValue(of(mockDetail));
      store['_rows'].set([mockRow]);
      const result = await store.update('gr1', { score: 18 });
      expect(result).toBeTruthy();
    });

    it('maneja error', async () => {
      apiSpy.updateGrade.and.returnValue(throwError(() => new Error('Fail')));
      const result = await store.update('gr1', { score: 18 });
      expect(result).toBeNull();
    });
  });

  describe('bulkUpsert', () => {
    it('envía bulk y actualiza rows', async () => {
      const summary = { requested: 1, created: 1, updated: 0, records: [mockDetail] };
      apiSpy.bulkUpsert.and.returnValue(of(summary));
      const result = await store.bulkUpsert('e1', [{ studentPublicUuid: 's1', score: 15 }]);
      expect(result).toBeTruthy();
      expect(result!.created).toBe(1);
      expect(store.lastBulk()).toBeTruthy();
    });
  });

  describe('remove', () => {
    it('elimina y quita de rows', async () => {
      apiSpy.deleteGrade.and.returnValue(of(undefined));
      store['_rows'].set([mockRow]);
      const result = await store.remove('gr1');
      expect(result).toBeTrue();
      expect(store.rows()).toEqual([]);
    });

    it('maneja error', async () => {
      apiSpy.deleteGrade.and.returnValue(throwError(() => new Error('Fail')));
      const result = await store.remove('gr1');
      expect(result).toBeFalse();
    });
  });

  describe('clear', () => {
    it('reinicia estado', () => {
      store['_rows'].set([mockRow]);
      store['_lastBulk'].set({ requested: 1, created: 1, updated: 0, records: [] });
      store.clear();
      expect(store.rows()).toEqual([]);
      expect(store.lastBulk()).toBeNull();
      expect(store.currentEvaluationUuid()).toBeNull();
    });
  });
});
