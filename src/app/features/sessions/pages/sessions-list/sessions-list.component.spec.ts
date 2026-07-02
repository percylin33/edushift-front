import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SessionsListComponent } from './sessions-list.component';
import { SessionsApiService } from '../../services';
import { LearningSessionRow, SessionStatus } from '../../models';

describe('SessionsListComponent', () => {
  let fixture: ComponentFixture<SessionsListComponent>;
  let component: SessionsListComponent;
  let fakeApi: jasmine.SpyObj<SessionsApiService>;

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
      'startSession',
      'completeSession',
      'cancelSession',
    ]);
    TestBed.configureTestingModule({
      imports: [SessionsListComponent],
      providers: [
        provideRouter([]),
        { provide: SessionsApiService, useValue: fakeApi },
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
    expect((component as any).sessions()).toHaveSize(1);
    expect((component as any).loading()).toBeFalse();
  });

  it('ngOnInit maneja error', async () => {
    configureModule();
    fakeApi.listSessions.and.returnValue(throwError(() => new Error('boom')));
    await component.ngOnInit();
    expect((component as any).errorMessage()).toBe('boom');
  });

  it('statusLabel y statusBadgeClass delegan al modelo', () => {
    configureModule();
    expect((component as any).getStatusLabel(SessionStatus.PLANNED)).toBe('Planificada');
    expect((component as any).getStatusBadgeClass(SessionStatus.PLANNED)).toContain('neutral');
  });

  it('formatDate formatea en es', () => {
    configureModule();
    const formatted = (component as any).formatDate(new Date('2026-06-15'));
    expect(formatted).toContain('2026');
  });

  it('toggleSelection agrega y quita', () => {
    configureModule();
    (component as any).toggleSelection('sess-1');
    expect((component as any).selectedSessions().has('sess-1')).toBeTrue();
    (component as any).toggleSelection('sess-1');
    expect((component as any).selectedSessions().has('sess-1')).toBeFalse();
  });

  it('clearSelection vacía selección', () => {
    configureModule();
    (component as any).toggleSelection('sess-1');
    (component as any).clearSelection();
    expect((component as any).selectedSessions().size).toBe(0);
  });

  it('isAllSelected / isIndeterminate reflejan selección', () => {
    configureModule();
    (component as any).sessions.set([session, { ...session, publicUuid: 'sess-2' }]);
    expect((component as any).isAllSelected()).toBeFalse();
    (component as any).toggleSelection('sess-1');
    (component as any).toggleSelection('sess-2');
    expect((component as any).isAllSelected()).toBeTrue();
    expect((component as any).isIndeterminate()).toBeFalse();
  });

  it('toggleSelectAll selecciona todos los PLANNED/IN_PROGRESS', () => {
    configureModule();
    (component as any).sessions.set([
      session,
      { ...session, publicUuid: 'sess-2' },
      { ...session, publicUuid: 'sess-3', status: SessionStatus.COMPLETED },
    ]);
    (component as any).toggleSelectAll();
    const sel = (component as any).selectedSessions();
    expect(sel.has('sess-1')).toBeTrue();
    expect(sel.has('sess-2')).toBeTrue();
    expect(sel.has('sess-3')).toBeFalse();
  });

  it('bulkComplete procesa seleccionados', async () => {
    configureModule();
    (component as any).sessions.set([session, { ...session, publicUuid: 'sess-2' }]);
    (component as any).selectedSessions.set(new Set(['sess-1', 'sess-2']));
    fakeApi.listSessions.and.returnValue(of([]));
    fakeApi.completeSession.and.returnValue(of({ publicUuid: 'x' } as any));
    await (component as any).bulkComplete();
    expect(fakeApi.completeSession).toHaveBeenCalledTimes(2);
    expect((component as any).bulkActionLoading()).toBeFalse();
  });

  it('bulkComplete vacío no llama api', async () => {
    configureModule();
    fakeApi.listSessions.and.returnValue(of([]));
    await (component as any).bulkComplete();
    expect(fakeApi.completeSession).not.toHaveBeenCalled();
  });

  it('startSession confirmado llama api', async () => {
    configureModule();
    spyOn(window, 'confirm').and.returnValue(true);
    fakeApi.startSession.and.returnValue(of({ publicUuid: 'x' } as any));
    fakeApi.listSessions.and.returnValue(of([]));
    await (component as any).startSession(session);
    expect(fakeApi.startSession).toHaveBeenCalled();
  });

  it('startSession cancelado no llama api', async () => {
    configureModule();
    spyOn(window, 'confirm').and.returnValue(false);
    await (component as any).startSession(session);
    expect(fakeApi.startSession).not.toHaveBeenCalled();
  });

  it('completeSession confirmado llama api', async () => {
    configureModule();
    spyOn(window, 'confirm').and.returnValue(true);
    fakeApi.completeSession.and.returnValue(of({ publicUuid: 'x' } as any));
    fakeApi.listSessions.and.returnValue(of([]));
    await (component as any).completeSession(session);
    expect(fakeApi.completeSession).toHaveBeenCalled();
  });

  it('cancelSession con motivo llama api', async () => {
    configureModule();
    spyOn(window, 'prompt').and.returnValue('razón');
    fakeApi.cancelSession.and.returnValue(of({ publicUuid: 'x' } as any));
    fakeApi.listSessions.and.returnValue(of([]));
    await (component as any).cancelSession(session);
    expect(fakeApi.cancelSession).toHaveBeenCalledWith('sess-1', { version: 1, reason: 'razón' });
  });

  it('cancelSession cancelado por prompt no llama api', async () => {
    configureModule();
    spyOn(window, 'prompt').and.returnValue(null);
    await (component as any).cancelSession(session);
    expect(fakeApi.cancelSession).not.toHaveBeenCalled();
  });

  it('onCreate navega a NEW', () => {
    configureModule();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    (component as any).onCreate();
    expect(router.navigate).toHaveBeenCalled();
  });

  it('viewDetail navega al detalle', () => {
    configureModule();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    (component as any).viewDetail('sess-1');
    expect(router.navigate).toHaveBeenCalled();
  });

  it('onFilterChange dispara fetch', () => {
    configureModule();
    fakeApi.listSessions.and.returnValue(of([]));
    (component as any).onFilterChange('status', SessionStatus.PLANNED);
    expect(fakeApi.listSessions).toHaveBeenCalled();
  });

  it('clearFilters limpia URL y recarga', () => {
    configureModule();
    fakeApi.listSessions.and.returnValue(of([]));
    (component as any).clearFilters();
    expect(fakeApi.listSessions).toHaveBeenCalled();
  });
});
