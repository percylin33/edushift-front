import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SessionsFormComponent } from './sessions-form.component';
import { SessionsApiService } from '../../services';
import { AcademicApiService } from '@features/academic/services';
import { AcademicPeriodRow, AcademicYearRow, PeriodType, UnitRow, AcademicYearStatus } from '@features/academic/models';
import { AssignmentListItemRaw } from '@features/teachers/models';
import { SessionTemplatesApiService } from '@features/academic/services/session-templates-api.service';
import { SessionStatus, LearningSessionDetail } from '../../models';

function testRows<T>(rows: Array<Partial<T>>): T[] {
  return rows as T[];
}

function checkedEvent(checked: boolean): Event {
  const event = new Event('change');
  Object.defineProperty(event, 'target', { value: { checked } });
  return event;
}

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
    sharedWithGrade: false,
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
      'getCompetency',
      'listYears',
      'listPeriods',
    ]);
    fakeAcademic.listYears.and.returnValue(of(testRows<AcademicYearRow>([])));
    fakeAcademic.listPeriods.and.returnValue(of(testRows<AcademicPeriodRow>([])));
    fakeAcademic.listAssignments.and.returnValue(of(testRows<AssignmentListItemRaw>([])));
    const fakeTemplates = jasmine.createSpyObj<SessionTemplatesApiService>(
      'SessionTemplatesApiService',
      ['listMine'],
    );
    fakeTemplates.listMine.and.returnValue(of([]));
    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, SessionsFormComponent],
      providers: [
        provideRouter([]),
        { provide: SessionsApiService, useValue: fakeApi },
        { provide: AcademicApiService, useValue: fakeAcademic },
        { provide: SessionTemplatesApiService, useValue: fakeTemplates },
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

  it('renderiza el formulario de creación después de cargar los datos iniciales', async () => {
    configureModule();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Nueva sesión');
    expect(fixture.nativeElement.textContent).toContain('¿Para qué clase es?');
  });

  it('ngOnInit carga asignaciones', async () => {
    configureModule();
    fakeAcademic.listAssignments.and.returnValue(
      of(testRows<AssignmentListItemRaw>([
        { publicUuid: 'a-1', coursePublicUuid: 'c-1', academicPeriodPublicUuid: 'p-1' },
      ])),
    );
    await component.ngOnInit();
    expect(component['assignments']().length).toBeGreaterThan(0);
  });

  it('filteredAssignments solo incluye el periodo seleccionado', async () => {
    configureModule();
    fakeAcademic.listYears.and.returnValue(
      of(testRows<AcademicYearRow>([{ publicUuid: 'y-1', status: AcademicYearStatus.Active, name: '2026' }])),
    );
    fakeAcademic.listPeriods.and.returnValue(
      of(testRows<AcademicPeriodRow>([
        {
          publicUuid: 'p-1',
          academicYearPublicUuid: 'y-1',
          periodType: PeriodType.Bimestre,
          ordinal: 1,
          name: 'I Bimestre',
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-05-31'),
        },
        {
          publicUuid: 'p-2',
          academicYearPublicUuid: 'y-1',
          periodType: PeriodType.Bimestre,
          ordinal: 2,
          name: 'II Bimestre',
          startDate: new Date('2026-06-01'),
          endDate: new Date('2026-08-31'),
        },
      ])),
    );
    fakeAcademic.listAssignments.and.returnValue(
      of(testRows<AssignmentListItemRaw>([
        {
          publicUuid: 'a-p1',
          coursePublicUuid: 'c-1',
          academicPeriodPublicUuid: 'p-1',
          teacherFullName: 'Ana',
          courseCode: 'MAT',
          sectionName: 'A',
        },
        {
          publicUuid: 'a-p2',
          coursePublicUuid: 'c-1',
          academicPeriodPublicUuid: 'p-2',
          teacherFullName: 'Ana',
          courseCode: 'MAT',
          sectionName: 'A',
        },
      ])),
    );
    await component.ngOnInit();

    component['selectedPeriodUuid'].set('p-1');
    expect(component['filteredAssignments']().map((assignment) => assignment.publicUuid)).toEqual([
      'a-p1',
    ]);

    component['onPeriodChange']('p-2');
    expect(component['filteredAssignments']().map((assignment) => assignment.publicUuid)).toEqual([
      'a-p2',
    ]);
  });

  it('al elegir asignación carga unidades con coursePublicUuid', async () => {
    configureModule();
    fakeAcademic.listAssignments.and.returnValue(
      of(testRows<AssignmentListItemRaw>([
        {
          publicUuid: 'a-1',
          coursePublicUuid: 'c-1',
          academicPeriodPublicUuid: 'p-1',
          teacherFullName: 'Ana',
          courseCode: 'MAT',
          sectionName: 'A',
        },
      ])),
    );
    fakeAcademic.listUnits.and.returnValue(
      of(testRows<UnitRow>([
        { publicUuid: 'u-1', name: 'Unidad 1', displayOrder: 1, isActive: true },
        { publicUuid: 'u-2', name: 'Unidad 2', displayOrder: 2, isActive: true },
      ])),
    );
    fakeAcademic.listCompetencies.and.returnValue(of([]));
    await component.ngOnInit();

    component['form'].get('assignmentUuid')?.setValue('a-1');
    await fixture.whenStable();

    expect(fakeAcademic.listUnits).toHaveBeenCalledWith('c-1');
    expect(component['units']().length).toBe(2);
  });

  it('ngOnInit en edit hidrata form', async () => {
    configureModule('sess-1');
    fakeAcademic.listAssignments.and.returnValue(
      of(testRows<AssignmentListItemRaw>([{ publicUuid: 'a-1', coursePublicUuid: 'c-1' }])),
    );
    fakeAcademic.listUnits.and.returnValue(
      of(testRows<UnitRow>([{ publicUuid: 'u-1', name: 'U1', displayOrder: 1, isActive: true }])),
    );
    fakeAcademic.listCompetencies.and.returnValue(of([]));
    fakeApi.getSession.and.returnValue(of(detail));
    await component.ngOnInit();
    expect(component['isEdit']()).toBeTrue();
    expect(component['form'].get('title')?.value).toBe('Intro');
  });
  it('isReadOnly true para COMPLETED', async () => {
    configureModule('sess-1');
    fakeAcademic.listAssignments.and.returnValue(of([]));
    fakeApi.getSession.and.returnValue(of({ ...detail, status: SessionStatus.COMPLETED }));
    await component.ngOnInit();
    expect(component['isReadOnly']()).toBeTrue();
  });

  it('isReadOnly true para CANCELLED', async () => {
    configureModule('sess-1');
    fakeAcademic.listAssignments.and.returnValue(of([]));
    fakeApi.getSession.and.returnValue(of({ ...detail, status: SessionStatus.CANCELLED }));
    await component.ngOnInit();
    expect(component['isReadOnly']()).toBeTrue();
  });

  it('addActivity / removeActivity manipulan FormArray', () => {
    configureModule();
    component['addActivity']();
    expect(component['activitiesArray'].length).toBe(1);
    component['removeActivity'](0);
    expect(component['activitiesArray'].length).toBe(0);
  });

  it('addMaterial / removeMaterial manipulan FormArray', () => {
    configureModule();
    component['addMaterial']();
    expect(component['materialsArray'].length).toBe(1);
    component['removeMaterial'](0);
    expect(component['materialsArray'].length).toBe(0);
  });

  it('isCompetencySelected y toggleCompetency reflejan signal', () => {
    configureModule();
    expect(component['isCompetencySelected']('c-1')).toBeFalse();
    component['toggleCompetency']('c-1', checkedEvent(true));
    expect(component['isCompetencySelected']('c-1')).toBeTrue();
    component['toggleCompetency']('c-1', checkedEvent(false));
    expect(component['isCompetencySelected']('c-1')).toBeFalse();
  });

  it('toggleCapacity agrega y quita', () => {
    configureModule();
    component['toggleCapacity']('cap-1', checkedEvent(true));
    expect(component['isCapacitySelected']('cap-1')).toBeTrue();
    component['toggleCapacity']('cap-1', checkedEvent(false));
    expect(component['isCapacitySelected']('cap-1')).toBeFalse();
  });

  it('onSubmit inválido marca touched y no llama api', async () => {
    configureModule();
    await component['onSubmit']();
    expect(component['form'].touched).toBeTrue();
    expect(fakeApi.createSession).not.toHaveBeenCalled();
  });

  it('onSubmit válido en create llama createSession', async () => {
    configureModule();
    component['form'].patchValue({
      assignmentUuid: 'a-1',
      unitUuid: 'u-1',
      scheduledDate: '2026-06-15',
      title: 'Intro',
      durationMinutes: 90,
      objective: 'obj',
    });
    fakeApi.createSession.and.returnValue(of(detail));
    await component['onSubmit']();
    expect(fakeApi.createSession).toHaveBeenCalled();
  });

  it('onSubmit en edit llama updateSession', async () => {
    configureModule('sess-1');
    fakeAcademic.listAssignments.and.returnValue(of([]));
    fakeApi.getSession.and.returnValue(of(detail));
    await component.ngOnInit();
    fakeApi.updateSession.and.returnValue(of(detail));
    await component['onSubmit']();
    expect(fakeApi.updateSession).toHaveBeenCalledWith('sess-1', jasmine.any(Object));
  });
});
