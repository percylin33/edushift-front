import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SessionsDetailComponent } from './sessions-detail.component';
import { SessionsApiService } from '../../services';
import { LearningSessionDetail, SessionStatus } from '../../models';

describe('SessionsDetailComponent', () => {
  let fixture: ComponentFixture<SessionsDetailComponent>;
  let component: SessionsDetailComponent;
  let fakeApi: jasmine.SpyObj<SessionsApiService>;

  const detail: LearningSessionDetail = {
    publicUuid: 'sess-1',
    version: 1,
    assignment: {
      publicUuid: 'a-1',
      teacher: { publicUuid: 't-1', firstName: 'M', lastName: 'G' },
      course: { publicUuid: 'c-1', code: 'M', name: 'M' },
      section: { publicUuid: 'sec-1', name: 'A' },
      period: {
        publicUuid: 'p-1',
        periodType: 'Q',
        ordinal: 1,
        name: 'Q1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    },
    unit: { publicUuid: 'u-1', name: 'U1', displayOrder: 1 },
    title: 'Intro',
    objective: 'obj',
    scheduledDate: new Date('2026-06-15'),
    durationMinutes: 90,
    status: SessionStatus.PLANNED,
    content: { objective: 'obj', activities: ['a1'], materials: ['m1'], observations: '' },
    competencies: [{ publicUuid: 'comp-1', code: 'C', name: 'Comp' }],
    capacities: [{ publicUuid: 'cap-1', code: 'Ca', name: 'Cap', competencyPublicUuid: 'comp-1' }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function configureModule(id: string | null = 'sess-1'): void {
    TestBed.resetTestingModule();
    fakeApi = jasmine.createSpyObj<SessionsApiService>('SessionsApiService', [
      'getSession',
      'startSession',
      'completeSession',
      'cancelSession',
    ]);
    TestBed.configureTestingModule({
      imports: [SessionsDetailComponent],
      providers: [
        provideRouter([]),
        { provide: SessionsApiService, useValue: fakeApi },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (_: string) => id } } },
        },
      ],
    });
    fixture = TestBed.createComponent(SessionsDetailComponent);
    component = fixture.componentInstance;
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnInit carga sesión', async () => {
    configureModule();
    fakeApi.getSession.and.returnValue(of(detail));
    await component.ngOnInit();
    expect((component as any).session()?.title).toBe('Intro');
    expect((component as any).loading()).toBeFalse();
  });

  it('ngOnInit maneja error', async () => {
    configureModule();
    fakeApi.getSession.and.returnValue(throwError(() => new Error('boom')));
    await component.ngOnInit();
    expect((component as any).errorMessage()).toBe('boom');
  });

  it('ngOnInit sin id navega a LIST', async () => {
    configureModule(null);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    await component.ngOnInit();
    expect(router.navigate).toHaveBeenCalled();
  });

  it('isTerminal true para COMPLETED', () => {
    configureModule();
    (component as any).session.set({ ...detail, status: SessionStatus.COMPLETED });
    expect((component as any).isTerminal()).toBeTrue();
  });

  it('isTerminal true para CANCELLED', () => {
    configureModule();
    (component as any).session.set({ ...detail, status: SessionStatus.CANCELLED });
    expect((component as any).isTerminal()).toBeTrue();
  });

  it('isTerminal false para PLANNED', () => {
    configureModule();
    (component as any).session.set({ ...detail, status: SessionStatus.PLANNED });
    expect((component as any).isTerminal()).toBeFalse();
  });

  it('getStatusLabel / getStatusBadgeClass delegan', () => {
    configureModule();
    expect((component as any).getStatusLabel(SessionStatus.PLANNED)).toBe('Planificada');
    expect((component as any).getStatusBadgeClass(SessionStatus.PLANNED)).toContain('neutral');
  });

  it('editRoute construye URL de edición', () => {
    configureModule();
    expect((component as any).editRoute()).toContain('/edit');
  });

  it('formatDate y formatDateTime formatean', () => {
    configureModule();
    expect((component as any).formatDate(new Date('2026-06-15'))).toContain('2026');
    expect((component as any).formatDateTime(undefined)).toBe('—');
  });

  it('getCapacitiesForCompetency filtra por competencyUuid', () => {
    configureModule();
    (component as any).session.set(detail);
    const caps = (component as any).getCapacitiesForCompetency('comp-1');
    expect(caps).toHaveSize(1);
    expect(caps[0].publicUuid).toBe('cap-1');
  });

  it('startSession confirmado llama api', async () => {
    configureModule();
    (component as any).session.set(detail);
    spyOn(window, 'confirm').and.returnValue(true);
    fakeApi.startSession.and.returnValue(of({ ...detail, status: SessionStatus.IN_PROGRESS }));
    await (component as any).startSession();
    expect(fakeApi.startSession).toHaveBeenCalledWith('sess-1', jasmine.any(Object));
  });

  it('startSession cancelado no llama api', async () => {
    configureModule();
    (component as any).session.set(detail);
    spyOn(window, 'confirm').and.returnValue(false);
    await (component as any).startSession();
    expect(fakeApi.startSession).not.toHaveBeenCalled();
  });

  it('completeSession confirmado llama api', async () => {
    configureModule();
    (component as any).session.set({ ...detail, status: SessionStatus.IN_PROGRESS });
    spyOn(window, 'confirm').and.returnValue(true);
    fakeApi.completeSession.and.returnValue(of({ ...detail, status: SessionStatus.COMPLETED }));
    await (component as any).completeSession();
    expect(fakeApi.completeSession).toHaveBeenCalled();
  });

  it('cancelSession con motivo llama api', async () => {
    configureModule();
    (component as any).session.set(detail);
    spyOn(window, 'prompt').and.returnValue('razón');
    fakeApi.cancelSession.and.returnValue(of({ ...detail, status: SessionStatus.CANCELLED }));
    await (component as any).cancelSession();
    expect(fakeApi.cancelSession).toHaveBeenCalledWith(
      'sess-1',
      jasmine.objectContaining({ reason: 'razón' }),
    );
  });

  it('cancelSession cancelado por prompt no llama api', async () => {
    configureModule();
    (component as any).session.set(detail);
    spyOn(window, 'prompt').and.returnValue(null);
    await (component as any).cancelSession();
    expect(fakeApi.cancelSession).not.toHaveBeenCalled();
  });
});
