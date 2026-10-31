import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter, convertToParamMap } from '@angular/router';
import { detailFixture } from './admission-detail.fixture';
import { of, Subject } from 'rxjs';
import { AdmissionsPageComponent } from './admissions-list.page';
import { AdmissionsApiService } from '../services/admissions-api.service';
import { AcademicApiService } from '@features/academic/services/academic-api.service';
import { StudentsApiService } from '@features/students/services';
import { AuthService } from '@core/services';
import { AdmissionApplication } from '../models';

describe('Admitted applications without family confirmation', () => {
  let fixture: ComponentFixture<AdmissionsPageComponent>;
  const application: AdmissionApplication = {
    publicUuid: 'application',
    studentPublicUuid: null,
    studentFullName: 'Alumno QA',
    academicYearPublicUuid: 'year-active',
    academicYearName: '2026',
    gradePublicUuid: 'grade',
    gradeName: 'Primero',
    status: 'ADMITTED',
    source: 'IN_PERSON',
    submittedAt: '2026-10-21',
    lastStatusNote: null,
    enrollmentPublicUuid: null,
    createdAt: null,
    updatedAt: null,
    offerStatus: 'PENDING',
    offerSentAt: '2026-10-20',
    offerReminderDueAt: null,
    offerResponseAt: null,
  };
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdmissionsPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { view: 'applications' },
              paramMap: convertToParamMap({}),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        { provide: AuthService, useValue: { hasPermission: () => true, hasRole: () => false } },
        {
          provide: AdmissionsApiService,
          useValue: {
            list: () => of([application]),
            vacancies: () => of([]),
            reservations: () => of([]),
            detail: () => of({ success: true, data: detailFixture }),
          },
        },
        {
          provide: AcademicApiService,
          useValue: {
            listYears: () => of([{ publicUuid: 'year-active', name: '2026', status: 'ACTIVE' }]),
            listLevels: () => of([]),
          },
        },
        { provide: StudentsApiService, useValue: { list: () => of({ content: [] }) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdmissionsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });
  it('allows completing an admitted legacy pending offer without a student record', () => {
    expect(fixture.nativeElement.textContent).toContain('Continuar matrícula');
    expect(fixture.nativeElement.textContent).not.toContain('Reenviar enlace familiar');
    expect(fixture.nativeElement.textContent).not.toContain('Esperando respuesta familiar');
  });
  it('offers direct admission even when the school has no student records', () => {
    expect(fixture.nativeElement.querySelector('a[href^="/admissions/new"]')).toBeTruthy();
  });
  it('opens the stable application route without changing state', async () => {
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.componentInstance.openDetail({ ...application, status: 'RECEIVED' });
    expect(navigate).toHaveBeenCalledWith(['/admissions/applications', 'application'], {
      queryParams: { yearId: 'year-active' },
    });
    expect(fixture.componentInstance.applications()[0].status).toBe('ADMITTED');
  });
  it('offers a single contextual primary action in every status', () => {
    for (const status of fixture.componentInstance.statuses) {
      fixture.componentInstance.applications.set([{ ...application, status }]);
      fixture.detectChanges();
      const primaryButtons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('tbody button.bg-indigo-600'),
      );
      expect(primaryButtons.length).toBe(1);
    }
  });
  it('clears a linked application filter when changing year', () => {
    const page = fixture.componentInstance;
    page.applicationUuidFilter.set('old-application');
    const select: HTMLSelectElement = fixture.nativeElement.querySelector(
      'select[aria-label="Año académico"]',
    );
    select.dispatchEvent(new Event('change'));
    expect(page.applicationUuidFilter()).toBe('');
  });
  it('ignores the result of a previous academic year when responses arrive out of order', async () => {
    const api = TestBed.inject(AdmissionsApiService);
    const oldYear = new Subject<AdmissionApplication[]>();
    const newYear = new Subject<AdmissionApplication[]>();
    spyOn(api, 'list').and.callFake((year) => (year === 'old' ? oldYear : newYear));
    const page = fixture.componentInstance;
    page.yearUuid.set('old');
    page.refresh();
    page.yearUuid.set('new');
    page.refresh();
    newYear.next([{ ...application, academicYearPublicUuid: 'new' }]);
    await fixture.whenStable();
    oldYear.next([{ ...application, academicYearPublicUuid: 'old' }]);
    await fixture.whenStable();
    expect(page.applications()[0].academicYearPublicUuid).toBe('new');
    expect(page.loading()).toBeFalse();
  });
  it('does not request the student register while browsing applications', () => {
    const api = TestBed.inject(StudentsApiService);
    const list = spyOn(api, 'list').and.callThrough();
    fixture.componentInstance.refresh();
    expect(list).not.toHaveBeenCalled();
  });
});
