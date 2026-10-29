import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AcademicApiService } from '@features/academic/services';
import { SessionsListComponent } from './sessions-list.component';
import { SessionsApiService } from '../../services';
import { LearningSessionRow, SessionStatus } from '../../models';
import { ConfirmDialogService } from '@shared/components';

describe('SessionsListComponent', () => {
  let fixture: ComponentFixture<SessionsListComponent>;
  let component: SessionsListComponent;
  let fakeApi: jasmine.SpyObj<SessionsApiService>;
  let fakeConfirmDialog: jasmine.SpyObj<ConfirmDialogService>;

  const session: LearningSessionRow = {
    publicUuid: 'sess-1',
    version: 1,
    title: 'Intro',
    scheduledDate: new Date('2026-06-15'),
    durationMinutes: 90,
    status: SessionStatus.PLANNED,
    teacherName: 'Maria',
    courseCode: 'MATH',
    sectionName: 'A',
    unitName: 'U1',
    unitDisplayOrder: 1,
  };

  function configureModule(): void {
    fakeApi = jasmine.createSpyObj<SessionsApiService>('SessionsApiService', [
      'listSessions',
      'listSharedSessions',
      'startSession',
      'completeSession',
      'cancelSession',
    ]);
    fakeApi.listSharedSessions.and.returnValue(of([]));
    fakeConfirmDialog = jasmine.createSpyObj<ConfirmDialogService>('ConfirmDialogService', ['open']);
    fakeConfirmDialog.open.and.returnValue(Promise.resolve(false));
    TestBed.configureTestingModule({
      imports: [SessionsListComponent],
      providers: [
        provideRouter([]),
        { provide: SessionsApiService, useValue: fakeApi },
        { provide: ConfirmDialogService, useValue: fakeConfirmDialog },
        { provide: AcademicApiService, useValue: { listAssignments: () => of([]) } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (_: string) => null } } },
        },
      ],
    });
    fixture = TestBed.createComponent(SessionsListComponent);
    component = fixture.componentInstance;
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnInit carga sesiones', async () => {
    configureModule();
    fakeApi.listSessions.and.returnValue(of([session]));
    await component.ngOnInit();
    expect(component['sessions']()).toHaveSize(1);
    expect(component['loading']()).toBeFalse();
  });

  it('ngOnInit maneja error', async () => {
    configureModule();
    fakeApi.listSessions.and.returnValue(throwError(() => new Error('boom')));
    await component.ngOnInit();
    expect(component['errorMessage']()).toBe('boom');
  });

  it('statusLabel y statusBadgeClass delegan al modelo', () => {
    configureModule();
    expect(component['getStatusLabel'](SessionStatus.PLANNED)).toBe('Planificada');
    expect(component['getStatusBadgeClass'](SessionStatus.PLANNED)).toContain('neutral');
  });

  it('formatDate formatea en es', () => {
    configureModule();
    const formatted = component['formatDate'](new Date('2026-06-15'));
    expect(formatted).toContain('2026');
  });

  it('toggleSelection agrega y quita', () => {
    configureModule();
    component['toggleSelection']('sess-1');
    expect(component['selectedSessions']().has('sess-1')).toBeTrue();
    component['toggleSelection']('sess-1');
    expect(component['selectedSessions']().has('sess-1')).toBeFalse();
  });

  it('clearSelection vacía selección', () => {
    configureModule();
    component['toggleSelection']('sess-1');
    component['clearSelection']();
    expect(component['selectedSessions']().size).toBe(0);
  });

  it('isAllSelected / isIndeterminate reflejan selección', () => {
    configureModule();
    component['sessions'].set([session, { ...session, publicUuid: 'sess-2' }]);
    expect(component['isAllSelected']()).toBeFalse();
    component['toggleSelection']('sess-1');
    component['toggleSelection']('sess-2');
    expect(component['isAllSelected']()).toBeTrue();
    expect(component['isIndeterminate']()).toBeFalse();
  });

  it('toggleSelectAll selecciona todos los PLANNED/IN_PROGRESS', () => {
    configureModule();
    component['sessions'].set([
      session,
      { ...session, publicUuid: 'sess-2' },
      { ...session, publicUuid: 'sess-3', status: SessionStatus.COMPLETED },
    ]);
    component['toggleSelectAll']();
    const sel = component['selectedSessions']();
    expect(sel.has('sess-1')).toBeTrue();
    expect(sel.has('sess-2')).toBeTrue();
    expect(sel.has('sess-3')).toBeFalse();
  });

  it('bulkComplete procesa seleccionados', async () => {
    configureModule();
    component['sessions'].set([session, { ...session, publicUuid: 'sess-2' }]);
    component['selectedSessions'].set(new Set(['sess-1', 'sess-2']));
    fakeApi.listSessions.and.returnValue(of([]));
    fakeApi.completeSession.and.returnValue(of({ publicUuid: 'x' } as any));
    await component['bulkComplete']();
    expect(fakeApi.completeSession).toHaveBeenCalledTimes(2);
    expect(component['bulkActionLoading']()).toBeFalse();
  });

  it('bulkComplete vacío no llama api', async () => {
    configureModule();
    fakeApi.listSessions.and.returnValue(of([]));
    await component['bulkComplete']();
    expect(fakeApi.completeSession).not.toHaveBeenCalled();
  });

  it('startSession confirmado llama api', async () => {
    configureModule();
    fakeConfirmDialog.open.and.returnValue(Promise.resolve(true));
    fakeApi.startSession.and.returnValue(of({ publicUuid: 'x' } as any));
    fakeApi.listSessions.and.returnValue(of([]));
    await component['startSession'](session);
    expect(fakeApi.startSession).toHaveBeenCalled();
  });

  it('startSession cancelado no llama api', async () => {
    configureModule();
    fakeConfirmDialog.open.and.returnValue(Promise.resolve(false));
    await component['startSession'](session);
    expect(fakeApi.startSession).not.toHaveBeenCalled();
  });

  it('completeSession confirmado llama api', async () => {
    configureModule();
    fakeConfirmDialog.open.and.returnValue(Promise.resolve(true));
    fakeApi.completeSession.and.returnValue(of({ publicUuid: 'x' } as any));
    fakeApi.listSessions.and.returnValue(of([]));
    await component['completeSession'](session);
    expect(fakeApi.completeSession).toHaveBeenCalled();
  });

  it('cancelSession con motivo llama api', async () => {
    configureModule();
    spyOn(window, 'prompt').and.returnValue('razón');
    fakeApi.cancelSession.and.returnValue(of({ publicUuid: 'x' } as any));
    fakeApi.listSessions.and.returnValue(of([]));
    await component['cancelSession'](session);
    expect(fakeApi.cancelSession).toHaveBeenCalledWith('sess-1', { version: 1, reason: 'razón' });
  });

  it('cancelSession cancelado por prompt no llama api', async () => {
    configureModule();
    spyOn(window, 'prompt').and.returnValue(null);
    await component['cancelSession'](session);
    expect(fakeApi.cancelSession).not.toHaveBeenCalled();
  });

  it('onCreate navega a NEW', () => {
    configureModule();
    const router: any = TestBed.inject(Router);
    spyOn(router, 'navigate');
    component['onCreate']();
    expect(router.navigate).toHaveBeenCalled();
  });

  it('viewDetail navega al detalle', () => {
    configureModule();
    const router: any = TestBed.inject(Router);
    spyOn(router, 'navigate');
    component['viewDetail']('sess-1');
    expect(router.navigate).toHaveBeenCalled();
  });

  it('onFilterChange dispara fetch', () => {
    configureModule();
    fakeApi.listSessions.and.returnValue(of([]));
    component['onFilterChange']('status', SessionStatus.PLANNED);
    expect(fakeApi.listSessions).toHaveBeenCalled();
  });

  it('clearFilters limpia URL y recarga', () => {
    configureModule();
    fakeApi.listSessions.and.returnValue(of([]));
    component['clearFilters']();
    expect(fakeApi.listSessions).toHaveBeenCalled();
  });
});
