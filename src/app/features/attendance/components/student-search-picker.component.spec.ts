import { ComponentFixture, TestBed } from '@angular/core/testing';
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
    expect(component['levels']()).toHaveSize(1);
    expect(component['loadingCatalog']()).toBeFalse();
  });

  it('ngOnInit con error de niveles deja vacío', async () => {
    configureModule();
    fakeAcademic.listLevels.and.returnValue(throwError(() => new Error('boom')));
    await component.ngOnInit();
    expect(component['levels']()).toEqual([]);
  });

  it('onLevelChange limpia grado/sección y agenda search', () => {
    configureModule();
    component['levelUuid'].set('lv-1');
    component['gradeUuid'].set('g-1');
    component['sectionUuid'].set('sec-1');
    component['onLevelChange'](null);
    expect(component['levelUuid']()).toBeNull();
    expect(component['gradeUuid']()).toBeNull();
    expect(component['sectionUuid']()).toBeNull();
  });

  it('onGradeChange carga secciones del grado', async () => {
    configureModule();
    fakeAcademic.listSections.and.returnValue(of(sections));
    component['onGradeChange']('g-1');
    await Promise.resolve();
    await Promise.resolve();
    expect(fakeAcademic.listSections).toHaveBeenCalled();
  });

  it('onGradeChange null limpia sections', () => {
    configureModule();
    component['onGradeChange'](null);
    expect(component['sections']()).toEqual([]);
  });

  it('onQueryChange setea query', () => {
    configureModule();
    component['onQueryChange']('juan');
    expect(component['query']()).toBe('juan');
  });

  it('hasQueryOrFilter false sin filtros ni query', () => {
    configureModule();
    expect(component['hasQueryOrFilter']()).toBeFalse();
    component['query'].set('x');
    expect(component['hasQueryOrFilter']()).toBeTrue();
  });

  it('select emite selected event', () => {
    configureModule();
    const selected = jasmine.createSpy('selected');
    component.selected.subscribe(selected);
    component['select'](student);
    expect(selected).toHaveBeenCalledWith(student);
  });

  it('initials retorna primeras letras mayúsculas', () => {
    configureModule();
    expect(component['initials']({ ...student, firstName: 'Juan', lastName: 'Perez' })).toBe(
      'JP',
    );
    expect(component['initials']({ ...student, firstName: '', lastName: '' })).toBe('?');
  });

  it('availableGrades filtra por level seleccionado', () => {
    configureModule();
    component['levels'].set(levels);
    component['levelUuid'].set('lv-1');
    expect(component['availableGrades']()).toHaveSize(1);
    component['levelUuid'].set('other');
    expect(component['availableGrades']()).toHaveSize(0);
  });
});
