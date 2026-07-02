import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SessionsFormComponent } from './sessions-form.component';
import { SessionsApiService } from '../../services';
import { AcademicApiService } from '@features/academic/services';
import { SessionStatus, LearningSessionDetail } from '../../models';

describe('SessionsFormComponent', () => {
  let fixture: ComponentFixture<SessionsFormComponent>;
  let component: SessionsFormComponent;
  let fakeApi: jasmine.SpyObj<SessionsApiService>;
  let fakeAcademic: jasmine.SpyObj<AcademicApiService>;

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
    objective: 'objetivo',
    scheduledDate: new Date('2026-06-15'),
    durationMinutes: 90,
    status: SessionStatus.PLANNED,
    content: { objective: 'objetivo', activities: ['A1'], materials: ['M1'], observations: 'obs' },
    competencies: [],
    capacities: [],
    startedAt: undefined,
    endedAt: undefined,
    cancelledAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function configureModule(id: string | null = null): void {
    TestBed.resetTestingModule();
    fakeApi = jasmine.createSpyObj<SessionsApiService>('SessionsApiService', [
      'listSessions',
      'getSession',
      'createSession',
      'updateSession',
      'startSession',
      'completeSession',
      'cancelSession',
    ]);
    fakeAcademic = jasmine.createSpyObj<AcademicApiService>('AcademicApiService', [
      'listAssignments',
      'listUnits',
      'listCompetencies',
    ]);
    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, SessionsFormComponent],
      providers: [
        provideRouter([]),
        { provide: SessionsApiService, useValue: fakeApi },
        { provide: AcademicApiService, useValue: fakeAcademic },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (_: string) => id } } },
        },
      ],
    });
    fixture = TestBed.createComponent(SessionsFormComponent);
    component = fixture.componentInstance;
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnInit carga asignaciones', async () => {
    configureModule();
    fakeAcademic.listAssignments.and.returnValue(
      of([{ publicUuid: 'a-1', coursePublicUuid: 'c-1', courseUuid: 'c-1' } as any]),
    );
    await component.ngOnInit();
    expect((component as any).assignments().length).toBeGreaterThan(0);
  });

  it('ngOnInit en edit hidrata form', async () => {
    configureModule('sess-1');
    fakeAcademic.listAssignments.and.returnValue(
      of([{ publicUuid: 'a-1', coursePublicUuid: 'c-1', courseUuid: 'c-1' } as any]),
    );
    fakeAcademic.listUnits.and.returnValue(
      of([{ publicUuid: 'u-1', name: 'U1', displayOrder: 1, isActive: true } as any]),
    );
    fakeAcademic.listCompetencies.and.returnValue(of([]));
    fakeApi.getSession.and.returnValue(of(detail));
    await component.ngOnInit();
    expect((component as any).isEdit()).toBeTrue();
    expect((component as any).form.get('title')?.value).toBe('Intro');
  });

  it('isReadOnly true para COMPLETED', async () => {
    configureModule('sess-1');
    fakeAcademic.listAssignments.and.returnValue(of([]));
    fakeApi.getSession.and.returnValue(of({ ...detail, status: SessionStatus.COMPLETED }));
    await component.ngOnInit();
    expect((component as any).isReadOnly()).toBeTrue();
  });

  it('isReadOnly true para CANCELLED', async () => {
    configureModule('sess-1');
    fakeAcademic.listAssignments.and.returnValue(of([]));
    fakeApi.getSession.and.returnValue(of({ ...detail, status: SessionStatus.CANCELLED }));
    await component.ngOnInit();
    expect((component as any).isReadOnly()).toBeTrue();
  });

  it('addActivity / removeActivity manipulan FormArray', () => {
    configureModule();
    (component as any).addActivity();
    expect((component as any).activitiesArray.length).toBe(1);
    (component as any).removeActivity(0);
    expect((component as any).activitiesArray.length).toBe(0);
  });

  it('addMaterial / removeMaterial manipulan FormArray', () => {
    configureModule();
    (component as any).addMaterial();
    expect((component as any).materialsArray.length).toBe(1);
    (component as any).removeMaterial(0);
    expect((component as any).materialsArray.length).toBe(0);
  });

  it('isCompetencySelected y toggleCompetency reflejan signal', () => {
    configureModule();
    expect((component as any).isCompetencySelected('c-1')).toBeFalse();
    (component as any).toggleCompetency('c-1', { target: { checked: true } } as any);
    expect((component as any).isCompetencySelected('c-1')).toBeTrue();
    (component as any).toggleCompetency('c-1', { target: { checked: false } } as any);
    expect((component as any).isCompetencySelected('c-1')).toBeFalse();
  });

  it('toggleCapacity agrega y quita', () => {
    configureModule();
    (component as any).toggleCapacity('cap-1', { target: { checked: true } } as any);
    expect((component as any).isCapacitySelected('cap-1')).toBeTrue();
    (component as any).toggleCapacity('cap-1', { target: { checked: false } } as any);
    expect((component as any).isCapacitySelected('cap-1')).toBeFalse();
  });

  it('onSubmit inválido marca touched y no llama api', async () => {
    configureModule();
    await (component as any).onSubmit();
    expect((component as any).form.touched).toBeTrue();
    expect(fakeApi.createSession).not.toHaveBeenCalled();
  });

  it('onSubmit válido en create llama createSession', async () => {
    configureModule();
    (component as any).form.patchValue({
      assignmentUuid: 'a-1',
      unitUuid: 'u-1',
      scheduledDate: '2026-06-15',
      title: 'Intro',
      durationMinutes: 90,
      objective: 'obj',
    });
    fakeApi.createSession.and.returnValue(of(detail));
    await (component as any).onSubmit();
    expect(fakeApi.createSession).toHaveBeenCalled();
  });

  it('onSubmit en edit llama updateSession', async () => {
    configureModule('sess-1');
    fakeAcademic.listAssignments.and.returnValue(of([]));
    fakeApi.getSession.and.returnValue(of(detail));
    await component.ngOnInit();
    fakeApi.updateSession.and.returnValue(of(detail));
    await (component as any).onSubmit();
    expect(fakeApi.updateSession).toHaveBeenCalledWith('sess-1', jasmine.any(Object));
  });
});
