import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AttendanceStore, ScanOutcome } from './attendance.store';
import { AttendanceApiService } from '../services';

describe('AttendanceStore', () => {
  let store: AttendanceStore;
  let apiSpy: jasmine.SpyObj<AttendanceApiService>;

  const session = {
    publicUuid: 'sess-1',
    sectionPublicUuid: 'sec-1',
    occurredOn: new Date('2026-06-15'),
    slot: 'MORNING' as const,
    startsAt: new Date('2026-06-15'),
    status: 'ACTIVE' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const record = {
    publicUuid: 'rec-1',
    sessionPublicUuid: 'sess-1',
    studentPublicUuid: 'stu-1',
    studentFullName: 'Juan',
    status: 'PRESENT' as const,
    occurredAt: new Date('2026-06-15'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<AttendanceApiService>('AttendanceApiService', [
      'openSession',
      'closeSession',
      'listSessions',
      'listRecords',
      'updateRecord',
      'scanCheckIn',
      'manualCheckIn',
    ]);
    TestBed.configureTestingModule({
      providers: [AttendanceStore, { provide: AttendanceApiService, useValue: apiSpy }],
    });
    store = TestBed.inject(AttendanceStore);
  });

  it('inicia con estado vacío', () => {
    expect(store.currentSession()).toBeNull();
    expect(store.records()).toEqual([]);
    expect(store.lastScan()).toEqual({ kind: 'idle' });
    expect(store.error()).toBeNull();
    expect(store.hasActiveSession()).toBeFalse();
  });

  it('openSession guarda currentSession', async () => {
    apiSpy.openSession.and.returnValue(of(session));
    const result = await store.openSession({
      sectionPublicUuid: 'sec-1',
      slot: 'MORNING',
      occurredOn: '2026-06-15',
    });
    expect(result?.publicUuid).toBe('sess-1');
    expect(store.currentSession()?.publicUuid).toBe('sess-1');
  });

  it('openSession con error setea mensaje', async () => {
    apiSpy.openSession.and.returnValue(throwError(() => new Error('boom')));
    const result = await store.openSession({
      sectionPublicUuid: 'sec-1',
      slot: 'MORNING',
      occurredOn: '2026-06-15',
    });
    expect(result).toBeNull();
    expect(store.error()).toBe('boom');
  });

  it('closeCurrentSession llama api si hay sesión activa', async () => {
    apiSpy.openSession.and.returnValue(of(session));
    await store.openSession({
      sectionPublicUuid: 'sec-1',
      slot: 'MORNING',
      occurredOn: '2026-06-15',
    });
    apiSpy.closeSession.and.returnValue(
      of({ ...session, status: 'CLOSED' as const, closedAt: new Date() }),
    );
    await store.closeCurrentSession();
    expect(apiSpy.closeSession).toHaveBeenCalled();
  });

  it('closeCurrentSession retorna null si no hay sesión', async () => {
    const result = await store.closeCurrentSession();
    expect(result).toBeNull();
  });

  it('reset limpia slices', () => {
    store.reset();
    expect(store.currentSession()).toBeNull();
    expect(store.records()).toEqual([]);
    expect(store.lastScan()).toEqual({ kind: 'idle' });
    expect(store.error()).toBeNull();
  });

  it('applyListFilters carga listItems', async () => {
    apiSpy.listSessions.and.returnValue(
      of({
        items: [{ ...session, sectionLabel: 'A' }],
        totalElements: 1,
        totalPages: 1,
        page: 0,
        size: 20,
      }),
    );
    await store.applyListFilters({ date: '2026-06-15' });
    expect(store.listItems()).toHaveSize(1);
    expect(store.listTotalElements()).toBe(1);
  });

  it('applyListFilters con error setea mensaje', async () => {
    apiSpy.listSessions.and.returnValue(throwError(() => new Error('x')));
    await store.applyListFilters({});
    expect(store.error()).toBe('x');
    expect(store.listItems()).toEqual([]);
  });

  it('loadRecords guarda records', async () => {
    apiSpy.listRecords.and.returnValue(of([record]));
    await store.loadRecords('sess-1');
    expect(store.records()).toHaveSize(1);
  });

  it('updateRecord actualiza row en place', async () => {
    apiSpy.listRecords.and.returnValue(of([record]));
    await store.loadRecords('sess-1');
    apiSpy.updateRecord.and.returnValue(of({ ...record, status: 'LATE' as const }));
    await store.updateRecord('rec-1', { status: 'LATE' });
    expect(store.records()[0].status).toBe('LATE');
  });

  it('updateRecord con error setea mensaje', async () => {
    apiSpy.updateRecord.and.returnValue(throwError(() => new Error('x')));
    const result = await store.updateRecord('rec-1', { status: 'LATE' });
    expect(result).toBeNull();
  });

  it('scan exitoso mapea ScanOutcome', async () => {
    apiSpy.scanCheckIn.and.returnValue(of({ record, wasIdempotent: false }));
    const result = await store.scan('tok');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.idempotent).toBeFalse();
    }
  });

  it('scan con wasIdempotent true', async () => {
    apiSpy.scanCheckIn.and.returnValue(of({ record, wasIdempotent: true }));
    const result = await store.scan('tok');
    if (result.kind === 'ok') expect(result.idempotent).toBeTrue();
  });

  it('scan bloqueado si ya hay scan en vuelo', async () => {
    apiSpy.scanCheckIn.and.returnValue(of({ record, wasIdempotent: false }));
    const promise = store.scan('tok');
    const second = await store.scan('tok');
    expect(second.kind).toBe('idle');
    await promise;
  });

  it('scan con error mapea outcome', async () => {
    apiSpy.scanCheckIn.and.returnValue(
      throwError(() => ({ code: 'QR_INVALID', message: 'invalid' })),
    );
    const result = await store.scan('tok');
    expect(result.kind).toBe('invalid');
  });

  it('scan mapea errores conocidos a outcomes específicos', async () => {
    const codes = [
      { code: 'QR_INVALID', kind: 'invalid' },
      { code: 'QR_EXPIRED', kind: 'expired' },
      { code: 'QR_TENANT_MISMATCH', kind: 'tenant-mismatch' },
      { code: 'STUDENT_NOT_ENROLLED', kind: 'not-enrolled' },
      { code: 'STUDENT_NO_ACTIVE_ENROLLMENT', kind: 'no-active-enrollment' },
      { code: 'SESSION_CLOSED', kind: 'session-closed' },
      { code: 'SESSION_ALREADY_CLOSED', kind: 'session-closed' },
      { code: 'NETWORK_ERROR', kind: 'network' },
    ];
    for (const c of codes) {
      apiSpy.scanCheckIn.and.returnValue(throwError(() => ({ code: c.code })));
      const result = await store.scan('tok');
      expect(result.kind).toBe(c.kind);
    }
  });

  it('manualCheckIn exitoso', async () => {
    apiSpy.manualCheckIn.and.returnValue(of({ record, wasIdempotent: false }));
    const result = await store.manualCheckIn('stu-1');
    expect(result.kind).toBe('ok');
  });

  it('manualCheckIn bloqueado si scan en vuelo', async () => {
    apiSpy.scanCheckIn.and.returnValue(of({ record, wasIdempotent: false }));
    const promise = store.scan('tok');
    const second = await store.manualCheckIn('stu-1');
    expect(second.kind).toBe('idle');
    await promise;
  });

  it('clearLastScan vuelve a idle', () => {
    store.clearLastScan();
    expect(store.lastScan()).toEqual({ kind: 'idle' });
  });

  it('countByStatus inicializa contadores', () => {
    const counts = store.countByStatus();
    expect(counts.PRESENT).toBe(0);
    expect(counts.LATE).toBe(0);
    expect(counts.ABSENT).toBe(0);
    expect(counts.EXCUSED).toBe(0);
  });

  it('presentCount / absentCount / totalCount reflejan records', async () => {
    apiSpy.listRecords.and.returnValue(
      of([
        { ...record, status: 'PRESENT' as const },
        { ...record, publicUuid: 'rec-2', status: 'ABSENT' as const },
        { ...record, publicUuid: 'rec-3', status: 'LATE' as const },
      ]),
    );
    await store.loadRecords('sess-1');
    expect(store.totalCount()).toBe(3);
    expect(store.presentCount()).toBe(2);
    expect(store.absentCount()).toBe(1);
  });
});
