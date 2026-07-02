import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { StudentSearchPickerComponent } from './student-search-picker.component';
import { AcademicApiService } from '@features/academic/services';
import { AttendanceApiService } from '../services';
import { AttendanceStudentLookupItem } from '../models';

describe('StudentSearchPickerComponent', () => {
  let fixture: ComponentFixture<StudentSearchPickerComponent>;
  let component: StudentSearchPickerComponent;
  let fakeAcademic: jasmine.SpyObj<AcademicApiService>;
  let fakeAttendance: jasmine.SpyObj<AttendanceApiService>;

  const levels = [
    {
      publicUuid: 'lv-1',
      name: 'Primaria',
      grades: [{ publicUuid: 'g-1', name: '1°', gradeOrdinal: 1, sections: [] }] as any,
    },
  ] as any;

  const sections = [{ publicUuid: 'sec-1', name: 'A' }] as any;

  const student: AttendanceStudentLookupItem = {
    studentPublicUuid: 'stu-1',
    firstName: 'J',
    lastName: 'P',
    fullName: 'J P',
    documentNumber: '1',
    sectionPublicUuid: 'sec-1',
    sectionName: 'A',
    gradeName: '1°',
    levelName: 'Primaria',
  };

  function configureModule(): void {
    fakeAcademic = jasmine.createSpyObj<AcademicApiService>('AcademicApiService', [
      'listLevels',
      'listSections',
    ]);
    fakeAttendance = jasmine.createSpyObj<AttendanceApiService>('AttendanceApiService', [
      'lookupStudents',
    ]);
    TestBed.configureTestingModule({
      imports: [StudentSearchPickerComponent],
      providers: [
        { provide: AcademicApiService, useValue: fakeAcademic },
        { provide: AttendanceApiService, useValue: fakeAttendance },
      ],
    });
    fixture = TestBed.createComponent(StudentSearchPickerComponent);
    component = fixture.componentInstance;
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnInit carga niveles', async () => {
    configureModule();
    fakeAcademic.listLevels.and.returnValue(of(levels));
    await component.ngOnInit();
    expect((component as any).levels()).toHaveSize(1);
    expect((component as any).loadingCatalog()).toBeFalse();
  });

  it('ngOnInit con error de niveles deja vacío', async () => {
    configureModule();
    fakeAcademic.listLevels.and.returnValue(throwError(() => new Error('boom')));
    await component.ngOnInit();
    expect((component as any).levels()).toEqual([]);
  });

  it('onLevelChange limpia grado/sección y agenda search', () => {
    configureModule();
    (component as any).levelUuid.set('lv-1');
    (component as any).gradeUuid.set('g-1');
    (component as any).sectionUuid.set('sec-1');
    (component as any).onLevelChange(null);
    expect((component as any).levelUuid()).toBeNull();
    expect((component as any).gradeUuid()).toBeNull();
    expect((component as any).sectionUuid()).toBeNull();
  });

  it('onGradeChange carga secciones del grado', async () => {
    configureModule();
    fakeAcademic.listSections.and.returnValue(of(sections));
    (component as any).onGradeChange('g-1');
    await Promise.resolve();
    await Promise.resolve();
    expect(fakeAcademic.listSections).toHaveBeenCalled();
  });

  it('onGradeChange null limpia sections', () => {
    configureModule();
    (component as any).onGradeChange(null);
    expect((component as any).sections()).toEqual([]);
  });

  it('onQueryChange setea query', () => {
    configureModule();
    (component as any).onQueryChange('juan');
    expect((component as any).query()).toBe('juan');
  });

  it('hasQueryOrFilter false sin filtros ni query', () => {
    configureModule();
    expect((component as any).hasQueryOrFilter()).toBeFalse();
    (component as any).query.set('x');
    expect((component as any).hasQueryOrFilter()).toBeTrue();
  });

  it('select emite selected event', () => {
    configureModule();
    const selected = jasmine.createSpy('selected');
    component.selected.subscribe(selected);
    (component as any).select(student);
    expect(selected).toHaveBeenCalledWith(student);
  });

  it('initials retorna primeras letras mayúsculas', () => {
    configureModule();
    expect((component as any).initials({ ...student, firstName: 'Juan', lastName: 'Perez' })).toBe(
      'JP',
    );
    expect((component as any).initials({ ...student, firstName: '', lastName: '' })).toBe('?');
  });

  it('availableGrades filtra por level seleccionado', () => {
    configureModule();
    (component as any).levels.set(levels);
    (component as any).levelUuid.set('lv-1');
    expect((component as any).availableGrades()).toHaveSize(1);
    (component as any).levelUuid.set('other');
    expect((component as any).availableGrades()).toHaveSize(0);
  });
});
