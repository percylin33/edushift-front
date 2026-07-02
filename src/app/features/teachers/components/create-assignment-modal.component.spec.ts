import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { CreateAssignmentModalComponent } from './create-assignment-modal.component';
import { TeacherAssignmentsStore } from '../store';
import { AcademicApiService } from '@features/academic/services';
import { TeacherDetail } from '../models';
import { DocumentType, EmploymentStatus } from '@core/enums';

describe('CreateAssignmentModalComponent', () => {
  let fixture: ComponentFixture<CreateAssignmentModalComponent>;
  let component: CreateAssignmentModalComponent;
  let fakeStore: {
    saving: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    clearError: jasmine.Spy;
    create: jasmine.Spy;
  };
  let fakeAcademic: jasmine.SpyObj<AcademicApiService>;

  const teacher: TeacherDetail = {
    publicUuid: 't-1',
    documentType: DocumentType.Dni,
    documentNumber: '1',
    firstName: 'Maria',
    lastName: 'Gomez',
    fullName: 'Maria Gomez',
    specializations: [],
    employmentStatus: EmploymentStatus.Active,
    hasUserAccount: false,
  } as any;

  function configureModule(): void {
    fakeStore = {
      saving: signal(false),
      error: signal<string | null>(null),
      clearError: jasmine.createSpy('clearError'),
      create: jasmine.createSpy('create').and.returnValue(Promise.resolve(null)),
    };
    fakeAcademic = jasmine.createSpyObj<AcademicApiService>('AcademicApiService', [
      'listYears',
      'listSections',
      'listCourses',
      'listPeriods',
    ]);
    TestBed.configureTestingModule({
      imports: [CreateAssignmentModalComponent],
      providers: [
        { provide: TeacherAssignmentsStore, useValue: fakeStore },
        { provide: AcademicApiService, useValue: fakeAcademic },
      ],
    });
    fixture = TestBed.createComponent(CreateAssignmentModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('teacher', teacher);
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnInit limpia error y carga catálogos', async () => {
    configureModule();
    fakeAcademic.listYears.and.returnValue(of([]));
    await component.ngOnInit();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(fakeAcademic.listYears).toHaveBeenCalled();
  });

  it('ngOnInit maneja error y vacía catálogos', async () => {
    configureModule();
    fakeAcademic.listYears.and.returnValue(of([]));
    fakeAcademic.listYears.and.throwError('boom');
    await component.ngOnInit();
    expect((component as any).activeYear()).toBeNull();
    expect((component as any).sections()).toEqual([]);
  });

  it('isCourseApplicable false si level del curso no coincide con la sección', () => {
    configureModule();
    fakeAcademic.listYears.and.returnValue(of([]));
    (component as any).sections.set([
      { publicUuid: 'sec-1', levelPublicUuid: 'lv-1', levelCode: 'PRI' } as any,
    ]);
    (component as any).sectionUuid.set('sec-1');
    const course = {
      publicUuid: 'c-1',
      code: 'M',
      name: 'M',
      levels: [{ publicUuid: 'lv-2' }],
    } as any;
    expect((component as any).isCourseApplicable(course)).toBeFalse();
  });

  it('isCourseApplicable true si levels vacío (sin restricción)', () => {
    configureModule();
    (component as any).sections.set([{ publicUuid: 'sec-1', levelPublicUuid: 'lv-1' } as any]);
    (component as any).sectionUuid.set('sec-1');
    const course = { publicUuid: 'c-1', levels: [] } as any;
    expect((component as any).isCourseApplicable(course)).toBeTrue();
  });

  it('isCourseApplicable true sin sección seleccionada', () => {
    configureModule();
    const course = { publicUuid: 'c-1', levels: [{ publicUuid: 'lv-1' }] } as any;
    expect((component as any).isCourseApplicable(course)).toBeTrue();
  });

  it('canSubmit false si faltan section/course/period', () => {
    configureModule();
    expect((component as any).canSubmit()).toBeFalse();
  });

  it('canSubmit true con selección válida', () => {
    configureModule();
    (component as any).sectionUuid.set('sec-1');
    (component as any).courseUuid.set('c-1');
    (component as any).periodUuid.set('p-1');
    (component as any).courses.set([{ publicUuid: 'c-1', levels: [] } as any]);
    expect((component as any).canSubmit()).toBeTrue();
  });

  it('onSectionChange limpia course si deja de aplicar', () => {
    configureModule();
    (component as any).sections.set([{ publicUuid: 'sec-1', levelPublicUuid: 'lv-1' } as any]);
    (component as any).courses.set([
      { publicUuid: 'c-1', levels: [{ publicUuid: 'lv-99' }] } as any,
    ]);
    (component as any).courseUuid.set('c-1');
    (component as any).sectionUuid.set('sec-1');
    (component as any).onSectionChange('sec-1');
    expect((component as any).courseUuid()).toBe('');
  });

  it('onSubmit llama store con payload', async () => {
    configureModule();
    (component as any).sectionUuid.set('sec-1');
    (component as any).courseUuid.set('c-1');
    (component as any).periodUuid.set('p-1');
    (component as any).courses.set([{ publicUuid: 'c-1', levels: [] } as any]);
    fakeStore.create.and.returnValue(Promise.resolve({ publicUuid: 'a-1' }));
    const created = jasmine.createSpy('created');
    component.created.subscribe(created);
    await (component as any).onSubmit();
    expect(fakeStore.create).toHaveBeenCalled();
    expect(created).toHaveBeenCalled();
  });

  it('onSubmit no dispara si store devuelve null', async () => {
    configureModule();
    (component as any).sectionUuid.set('sec-1');
    (component as any).courseUuid.set('c-1');
    (component as any).periodUuid.set('p-1');
    (component as any).courses.set([{ publicUuid: 'c-1', levels: [] } as any]);
    fakeStore.create.and.returnValue(Promise.resolve(null));
    const created = jasmine.createSpy('created');
    component.created.subscribe(created);
    await (component as any).onSubmit();
    expect(created).not.toHaveBeenCalled();
  });

  it('close emite closed y limpia error', () => {
    configureModule();
    const closed = jasmine.createSpy('closed');
    component.closed.subscribe(closed);
    (component as any).close();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(closed).toHaveBeenCalled();
  });

  it('periodTypeLabel retorna etiqueta', () => {
    configureModule();
    expect((component as any).periodTypeLabel('QUARTER')).toBeDefined();
  });
});
