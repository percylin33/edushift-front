import { TestBed } from '@angular/core/testing';
import { DashboardStore } from './dashboard.store';
import { DashboardApiService } from '../services/dashboard-api.service';
import { of, throwError } from 'rxjs';

describe('DashboardStore', () => {
  let store: DashboardStore;
  let apiSpy: jasmine.SpyObj<DashboardApiService>;

  const mockOverview = {
    generatedAt: new Date(),
    attendanceRateToday: 85,
    enrollmentsConsidered: 200,
    openSessions: 5,
    uniqueStudentsRegisteredToday: 150,
    totalAbsencesToday: 25,
    topAbsentSections: [],
    recentClosedSessions: [],
    noClassToday: false,
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('DashboardApiService', [
      'getAttendanceOverview',
      'metrics',
      'widgets',
    ]);
    TestBed.configureTestingModule({
      providers: [DashboardStore, { provide: DashboardApiService, useValue: apiSpy }],
    });
    store = TestBed.inject(DashboardStore);
  });

  it('inicia con estado vacío', () => {
    expect(store.metrics()).toEqual([]);
    expect(store.widgets()).toEqual([]);
    expect(store.overview()).toBeNull();
    expect(store.loading()).toBeFalse();
    expect(store.error()).toBeNull();
    expect(store.isEmpty()).toBeTrue();
  });

  describe('loadAttendanceOverview', () => {
    it('carga overview exitosamente', () => {
      apiSpy.getAttendanceOverview.and.returnValue(of(mockOverview));
      store.loadAttendanceOverview();
      expect(store.loading()).toBeFalse();
      expect(store.overview()).toEqual(mockOverview);
      expect(store.lastLoadedAt()).toBeTruthy();
      expect(store.isEmpty()).toBeFalse();
    });

    it('maneja error y deja overview anterior intacto', () => {
      apiSpy.getAttendanceOverview.and.returnValue(throwError(() => new Error('Network error')));
      store.loadAttendanceOverview();
      expect(store.loading()).toBeFalse();
      expect(store.error()).toContain('Network error');
    });

    it('no hace fetch si ya está cargando', () => {
      store['_loading'].set(true);
      store.loadAttendanceOverview();
      expect(apiSpy.getAttendanceOverview).not.toHaveBeenCalled();
    });
  });

  describe('setMetrics', () => {
    it('establece métricas', () => {
      store.setMetrics([{ key: 'test', label: 'Test', value: 1 }]);
      expect(store.metrics().length).toBe(1);
    });
  });

  describe('setWidgets', () => {
    it('establece widgets', () => {
      store.setWidgets([{ id: 'w1', type: 'metric', title: 'W', payload: {} }]);
      expect(store.widgets().length).toBe(1);
    });
  });

  describe('reset', () => {
    it('reinicia estado', () => {
      store.setMetrics([{ key: 'k', label: 'L', value: 1 }]);
      store['_overview'].set(mockOverview);
      store.reset();
      expect(store.isEmpty()).toBeTrue();
      expect(store.overview()).toBeNull();
    });
  });
});
