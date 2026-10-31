import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { AcademicApiService } from '@features/academic/services/academic-api.service';
import { StudentsApiService } from '@features/students/services';
import { StudentRow } from '@features/students/models';
import { SpringPage } from '@core/models';
import { AdmissionsApiService } from '../services/admissions-api.service';
import { ExistingStudentAdmissionComponent } from './existing-student-admission.component';

describe('Existing student admission search', () => {
  it('searches subsequent pages instead of limiting selection to the first hundred students', () => {
    const list = jasmine.createSpy('list').and.returnValue(of({ content: [], last: false }));
    TestBed.configureTestingModule({
      imports: [ExistingStudentAdmissionComponent],
      providers: [
        { provide: StudentsApiService, useValue: { list } },
        { provide: AcademicApiService, useValue: { listLevels: () => of([]) } },
        { provide: AdmissionsApiService, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(ExistingStudentAdmissionComponent);
    fixture.componentRef.setInput('year', 'year');
    fixture.componentInstance.term = 'Documento';
    fixture.componentInstance.search(6);
    expect(list).toHaveBeenCalledWith(
      { search: 'Documento' },
      { page: 6, size: 20, sort: 'lastName,asc' },
    );
    expect(fixture.componentInstance.pageSignal()).toBe(6);
  });

  it('cancels older search results and clears selection when a new search starts', () => {
    const previous = new Subject<SpringPage<StudentRow>>();
    const list = jasmine
      .createSpy('list')
      .and.returnValues(previous, of({ content: [], last: true }));
    TestBed.configureTestingModule({
      imports: [ExistingStudentAdmissionComponent],
      providers: [
        { provide: StudentsApiService, useValue: { list } },
        { provide: AcademicApiService, useValue: { listLevels: () => of([]) } },
        { provide: AdmissionsApiService, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(ExistingStudentAdmissionComponent);
    fixture.componentRef.setInput('year', 'year');
    fixture.componentInstance.studentUuid = 'old-student';
    fixture.componentInstance.search();
    expect(previous.observed).toBeFalse();
    expect(fixture.componentInstance.studentUuid).toBe('');
    expect(fixture.componentInstance.loadingSignal()).toBeFalse();
  });
});
