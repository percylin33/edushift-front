import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { AttendanceSessionDetailPageComponent } from './attendance-session-detail.page';
import { AttendanceStore } from '../../store';
import { AuthService } from '@core/services';
import { UserRole } from '@core/enums';
import { AttendanceRecord, AttendanceRecordStatus } from '../../models';
import { AttendanceReportService } from '../../services/attendance-report.service';

describe('AttendanceSessionDetailPageComponent', () => {
  let fixture: ComponentFixture<AttendanceSessionDetailPageComponent>;
  let component: AttendanceSessionDetailPageComponent;
  let fakeStore: {
    records: ReturnType<typeof signal<AttendanceRecord[]>>;
    loadingRecords: ReturnType<typeof signal<boolean>>;
    loadingSession: ReturnType<typeof signal<boolean>>;
    currentSession: ReturnType<
      typeof signal<{
        status: string;
        sectionName?: string;
        publicUuid: string;
        occurredOn: Date;
        slot: string;
      } | null>
    >;
    loadRecords: jasmine.Spy;
    closeCurrentSession: jasmine.Spy;
    updateRecord: jasmine.Spy;
  };
  let fakeAuth: { hasRole: jasmine.Spy; hasPermission: jasmine.Spy };

  const session = {
    publicUuid: 'sess-1',
    sectionName: 'A',
    occurredOn: new Date('2026-06-15'),
    slot: 'MORNING' as const,
    status: 'ACTIVE' as const,
  };

  const record: AttendanceRecord = {
    publicUuid: 'rec-1',
    sessionPublicUuid: 'sess-1',
    studentPublicUuid: 'stu-1',
    studentFullName: 'Juan',
    studentDocumentNumber: '12345678',
    status: 'PRESENT' as AttendanceRecordStatus,
    occurredAt: new Date('2026-06-15'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function configureModule(uuid: string | null = 'sess-1'): void {
    TestBed.resetTestingModule();
    fakeStore = {
      records: signal<AttendanceRecord[]>([]),
      loadingRecords: signal(false),
      loadingSession: signal(false),
      currentSession: signal<any>(null),
      loadRecords: jasmine.createSpy('loadRecords').and.returnValue(Promise.resolve()),
      closeCurrentSession: jasmine
        .createSpy('closeCurrentSession')
        .and.returnValue(Promise.resolve(null)),
      updateRecord: jasmine.createSpy('updateRecord').and.returnValue(Promise.resolve(null)),
    };
    fakeAuth = {
      hasRole: jasmine.createSpy('hasRole').and.returnValue(false),
      hasPermission: jasmine.createSpy('hasPermission').and.returnValue(false),
    };
    TestBed.configureTestingModule({
      imports: [AttendanceSessionDetailPageComponent],
      providers: [
        provideRouter([]),
        { provide: AttendanceStore, useValue: fakeStore },
        {
          provide: AttendanceReportService,
          useValue: {
            requestInstitutionalExport: jasmine.createSpy('requestInstitutionalExport'),
            downloadJob: jasmine.createSpy('downloadJob'),
          },
        },
        { provide: AuthService, useValue: fakeAuth },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (_: string) => uuid } } },
        },
      ],
    });
    fixture = TestBed.createComponent(AttendanceSessionDetailPageComponent);
    component = fixture.componentInstance;
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnInit sin uuid no llama load', async () => {
    configureModule(null);
    await component.ngOnInit();
    expect(fakeStore.loadRecords).not.toHaveBeenCalled();
  });

  it('ngOnInit carga records', async () => {
    configureModule();
    await component.ngOnInit();
    expect(fakeStore.loadRecords).toHaveBeenCalledWith('sess-1');
  });

  it('title y subtitle derivados del currentSession', () => {
    configureModule();
    fakeStore.currentSession.set(session);
    expect(component['title']()).toBe('A');
    expect(component['subtitle']()).toContain('MORNING');
  });

  it('canClose true para ACTIVE', () => {
    configureModule();
    fakeStore.currentSession.set(session);
    expect(component['canClose']()).toBeTrue();
    fakeStore.currentSession.set({ ...session, status: 'CLOSED' });
    expect(component['canClose']()).toBeFalse();
  });

  it('filteredRecords aplica onlyPending', () => {
    configureModule();
    fakeStore.records.set([record, { ...record, publicUuid: 'rec-2', status: 'ABSENT' }]);
    expect(component['filteredRecords']()).toHaveSize(2);
    component['onlyPending'].set(true);
    expect(component['filteredRecords']()).toHaveSize(1);
  });

  it('canEdit true para TENANT_ADMIN', () => {
    configureModule();
    fakeStore.currentSession.set(session);
    fakeAuth.hasRole.and.callFake((...roles: UserRole[]) => roles.includes(UserRole.TenantAdmin));
    expect(component['canEdit'](record)).toBeTrue();
  });

  it('canEdit false para roles desconocidos', () => {
    configureModule();
    fakeAuth.hasRole.and.returnValue(false);
    expect(component['canEdit'](record)).toBeFalse();
  });

  it('canEdit true para TEACHER en sesión CLOSED', () => {
    configureModule();
    fakeStore.currentSession.set({ ...session, status: 'CLOSED' });
    fakeAuth.hasRole.and.callFake((...roles: UserRole[]) => roles.includes(UserRole.Teacher));
    expect(component['canEdit'](record)).toBeTrue();
  });

  it('canEdit permite editar a TEACHER mientras la sesión está activa', () => {
    configureModule();
    fakeStore.currentSession.set(session);
    fakeAuth.hasRole.and.callFake((...roles: UserRole[]) => roles.includes(UserRole.Teacher));
    expect(component['canEdit'](record)).toBeTrue();
  });

  it('openEdit / closeEdit alternan editing', () => {
    configureModule();
    component['openEdit'](record);
    expect(component['editing']()?.publicUuid).toBe('rec-1');
    component['closeEdit']();
    expect(component['editing']()).toBeNull();
  });

  it('onSave llama updateRecord y reload', async () => {
    configureModule();
    fakeStore.updateRecord.and.returnValue(Promise.resolve({ ...record, status: 'LATE' }));
    fakeStore.loadRecords.and.returnValue(Promise.resolve());
    await component['onSave'](record, { status: 'LATE' });
    expect(fakeStore.updateRecord).toHaveBeenCalledWith('rec-1', { status: 'LATE' });
    expect(fakeStore.loadRecords).toHaveBeenCalled();
  });

  it('onSave sin éxito no recarga records', async () => {
    configureModule();
    fakeStore.updateRecord.and.returnValue(Promise.resolve(null));
    await component['onSave'](record, { status: 'LATE' });
    expect(fakeStore.loadRecords).not.toHaveBeenCalled();
  });

  it('onClose delega al store', () => {
    configureModule();
    component['onClose']();
    expect(fakeStore.closeCurrentSession).toHaveBeenCalled();
  });

});
