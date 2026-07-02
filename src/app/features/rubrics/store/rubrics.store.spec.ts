import { TestBed } from '@angular/core/testing';
import { RubricsStore } from './rubrics.store';
import { RubricsApiService } from '../services';
import { of, throwError } from 'rxjs';

describe('RubricsStore', () => {
  let store: RubricsStore;
  let apiSpy: jasmine.SpyObj<RubricsApiService>;

  const mockRow = {
    publicUuid: 'r1',
    name: 'Rúbrica',
    description: undefined,
    isSystem: false,
    parentRubricPublicUuid: undefined,
    criterionCount: 2,
    criterionSummary: ['50% A', '50% B'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDetail = {
    publicUuid: 'r1',
    name: 'Rúbrica',
    description: undefined,
    criteria: [{ key: 'a', name: 'A', weight: 50, descriptors: [] }],
    levels: [{ code: 'AD', name: 'Destacado' }],
    isSystem: false,
    parentRubricPublicUuid: undefined,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('RubricsApiService', [
      'listRubrics',
      'listSystemRubrics',
      'getRubric',
      'createRubric',
      'forkRubric',
      'updateRubric',
      'deleteRubric',
    ]);
    TestBed.configureTestingModule({
      providers: [RubricsStore, { provide: RubricsApiService, useValue: apiSpy }],
    });
    store = TestBed.inject(RubricsStore);
  });

  it('inicia con estado vacío', () => {
    expect(store.rows()).toEqual([]);
    expect(store.selected()).toBeNull();
    expect(store.loading()).toBeFalse();
    expect(store.loadingDetail()).toBeFalse();
    expect(store.saving()).toBeFalse();
    expect(store.error()).toBeNull();
    expect(store.isEmpty()).toBeTrue();
  });

  describe('load', () => {
    it('carga rows exitosamente', async () => {
      apiSpy.listRubrics.and.returnValue(of([mockRow]));
      await store.load();
      expect(store.rows().length).toBe(1);
      expect(store.loading()).toBeFalse();
    });

    it('maneja error', async () => {
      apiSpy.listRubrics.and.returnValue(throwError(() => new Error('Fail')));
      await store.load();
      expect(store.rows()).toEqual([]);
      expect(store.error()).toBeTruthy();
    });
  });

  describe('setFilters / clearFilters', () => {
    it('establece filtros y recarga', async () => {
      apiSpy.listRubrics.and.returnValue(of([mockRow]));
      await store.setFilters({ systemOnly: true });
      expect(store.filters().systemOnly).toBeTrue();
    });

    it('limpia filtros', async () => {
      apiSpy.listRubrics.and.returnValue(of([mockRow]));
      await store.clearFilters();
      expect(store.filters()).toEqual({});
    });
  });

  describe('loadSystemRubrics', () => {
    it('carga rúbricas del sistema', async () => {
      apiSpy.listSystemRubrics.and.returnValue(of([mockRow]));
      apiSpy.listRubrics.and.returnValue(of([mockRow]));
      await store.loadSystemRubrics();
      expect(apiSpy.listSystemRubrics).toHaveBeenCalled();
    });

    it('maneja error', async () => {
      apiSpy.listSystemRubrics.and.returnValue(throwError(() => new Error('Fail')));
      await store.loadSystemRubrics();
      expect(store.error()).toBeTruthy();
    });
  });

  describe('loadDetail', () => {
    it('carga detalle', async () => {
      apiSpy.getRubric.and.returnValue(of(mockDetail));
      const result = await store.loadDetail('r1');
      expect(result).toBeTruthy();
      expect(store.selected()).toBeTruthy();
    });

    it('maneja error', async () => {
      apiSpy.getRubric.and.returnValue(throwError(() => new Error('Fail')));
      const result = await store.loadDetail('r1');
      expect(result).toBeNull();
      expect(store.selected()).toBeNull();
    });
  });

  describe('create', () => {
    it('crea rúbrica y actualiza listado', async () => {
      apiSpy.createRubric.and.returnValue(of(mockDetail));
      apiSpy.listRubrics.and.returnValue(of([]));
      const result = await store.create({ name: 'Nueva', criteria: [], levels: [] });
      expect(result).toBeTruthy();
      expect(store.selected()).toBeTruthy();
    });
  });

  describe('fork', () => {
    it('forkea rúbrica', async () => {
      apiSpy.forkRubric.and.returnValue(of(mockDetail));
      apiSpy.listRubrics.and.returnValue(of([]));
      const result = await store.fork('r1');
      expect(result).toBeTruthy();
    });
  });

  describe('update', () => {
    it('actualiza rúbrica', async () => {
      apiSpy.updateRubric.and.returnValue(of(mockDetail));
      apiSpy.listRubrics.and.returnValue(of([mockRow]));
      const result = await store.update('r1', { name: 'Updated' });
      expect(result).toBeTruthy();
    });
  });

  describe('remove', () => {
    it('elimina rúbrica', async () => {
      apiSpy.deleteRubric.and.returnValue(of(undefined));
      apiSpy.listRubrics.and.returnValue(of([mockRow]));
      store['_rows'].set([mockRow]);
      const result = await store.remove('r1');
      expect(result).toBeTrue();
      expect(store.rows().length).toBe(0);
    });

    it('maneja error', async () => {
      apiSpy.deleteRubric.and.returnValue(throwError(() => new Error('Fail')));
      const result = await store.remove('r1');
      expect(result).toBeFalse();
    });
  });

  describe('computed: hasRows, hasSystemRubrics, hasUserRubrics', () => {
    it('hasRows es true si hay rows', () => {
      store['_rows'].set([mockRow]);
      expect(store.hasRows()).toBeTrue();
    });

    it('hasSystemRubrics es true si hay system', () => {
      store['_rows'].set([{ ...mockRow, isSystem: true }]);
      expect(store.hasSystemRubrics()).toBeTrue();
    });

    it('hasUserRubrics es true si hay user', () => {
      store['_rows'].set([mockRow]);
      expect(store.hasUserRubrics()).toBeTrue();
    });
  });
});
