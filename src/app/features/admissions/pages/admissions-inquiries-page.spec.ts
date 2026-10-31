import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { AdmissionsInquiriesPageComponent } from './admissions-inquiries-list.page';
import { AdmissionsApiService } from '../services/admissions-api.service';
import { AcademicApiService } from '@features/academic/services/academic-api.service';
import { AuthService } from '@core/services';
import { TenantService } from '@core/services/tenant.service';
import { AdmissionInquiry } from '../models';
import { ConfirmDialogService } from '@shared/components/confirm-dialog/confirm-dialog.service';

describe('Admissions inquiry to presential flow', () => {
  let fixture: ComponentFixture<AdmissionsInquiriesPageComponent>;
  let page: AdmissionsInquiriesPageComponent;
  let api: jasmine.SpyObj<AdmissionsApiService>;
  const row: AdmissionInquiry = {
    publicUuid: 'inquiry-a',
    academicYearPublicUuid: 'year-active',
    academicYearName: '2026',
    gradePublicUuid: 'grade-one',
    gradeName: 'Primero de primaria',
    contactName: 'María Valderrama',
    contactType: 'PHONE',
    contactValue: '+51 987-654-321',
    status: 'RECEIVED',
    note: null,
    convertedApplicationPublicUuid: null,
    createdAt: '2026-10-21T12:00:00Z',
  };
  beforeEach(async () => {
    api = jasmine.createSpyObj<AdmissionsApiService>('api', [
      'listInquiries',
      'updateInquiry',
      'convertInquiry',
      'createPresential',
      'inquiryHistory',
    ]);
    api.listInquiries.and.returnValue(
      of([
        row,
        {
          ...row,
          publicUuid: 'inquiry-b',
          contactName: 'Otro Apoderado',
          contactValue: '912345678',
          gradePublicUuid: 'grade-two',
          gradeName: 'Segundo de primaria',
        },
      ]),
    );
    api.updateInquiry.and.returnValue(of({ success: true, data: row }));
    await TestBed.configureTestingModule({
      imports: [AdmissionsInquiriesPageComponent],
      providers: [
        provideRouter([]),
        { provide: AdmissionsApiService, useValue: api },
        {
          provide: AcademicApiService,
          useValue: {
            listYears: () =>
              of([
                { publicUuid: 'year-planning', name: '2027', status: 'PLANNING' },
                { publicUuid: 'year-active', name: '2026', status: 'ACTIVE' },
              ]),
            listLevels: () =>
              of([
                {
                  name: 'Primaria',
                  grades: [
                    { publicUuid: 'grade-one', name: 'Primero de primaria' },
                    { publicUuid: 'grade-two', name: 'Segundo de primaria' },
                  ],
                },
              ]),
          },
        },
        { provide: TenantService, useValue: { tenantSlug: () => 'school' } },
        { provide: AuthService, useValue: { hasPermission: () => true } },
        {
          provide: ConfirmDialogService,
          useValue: { open: () => Promise.resolve(false) },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: {}, queryParamMap: convertToParamMap({}) } },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdmissionsInquiriesPageComponent);
    page = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });
  it('loads the active year by default', () => {
    expect(page.yearUuid()).toBe('year-active');
    expect(api.listInquiries).toHaveBeenCalledWith('year-active');
  });
  it('matches partial names without accents or letter case', () => {
    page.searchTerm.set('MARIA vald');
    expect(page.filteredInquiries().map((item) => item.publicUuid)).toEqual(['inquiry-a']);
  });
  it('matches phones without their formatting', () => {
    page.searchTerm.set('987654321');
    expect(page.filteredInquiries().length).toBe(1);
  });
  it('matches grade names and combines the grade and state filters', () => {
    page.searchTerm.set('primaria');
    page.gradeFilter.set('grade-two');
    expect(page.filteredInquiries()[0].publicUuid).toBe('inquiry-b');
    page.statusFilter.set('CLOSED');
    expect(page.filteredInquiries()).toEqual([]);
  });
  it('offers continuation for a received inquiry without requiring qualification', () => {
    const button = [...fixture.nativeElement.querySelectorAll('button')].find((element: Element) =>
      element.textContent?.includes('Continuar admisión'),
    ) as HTMLButtonElement;
    expect(button).toBeTruthy();
    button.click();
    expect(page.convertInquiry()?.publicUuid).toBe('inquiry-a');
    expect(page.draft.guardianPhone).toBe(row.contactValue);
    expect(page.draft.guardianFirstName).toBe('María');
    expect(page.draft.guardianLastName).toBe('Valderrama');
    expect(page.draft.source).toBe('WEBSITE');
  });
  it('opens a direct admission without manufacturing a public inquiry', () => {
    page.openPresential();
    fixture.detectChanges();
    expect(page.convertInquiry()).toBeNull();
    expect(page.presentialOpen()).toBeTrue();
    expect(fixture.nativeElement.querySelector('[name="presentialGrade"]')).toBeTruthy();
  });
  it('saves a presential attention note and moves a received inquiry to follow-up', () => {
    page.openNote(row);
    page.attentionNote = 'Vendrá el viernes';
    page.saveNote();
    expect(api.updateInquiry).toHaveBeenCalledWith(
      'inquiry-a',
      'CONTACTED',
      'Presencial: Vendrá el viernes',
      { responsibleName: '', nextAttentionDate: null, nextAction: '' },
    );
    expect(page.noteInquiry()).toBeNull();
  });
  it('opens the linked application instead of offering another conversion', () => {
    page.inquiries.set([
      {
        ...row,
        status: 'CONVERTED',
        convertedApplicationPublicUuid: 'application-a',
        convertedApplicationStatus: 'ENROLLED',
      },
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Matriculada');
    expect(fixture.nativeElement.textContent).not.toContain('Continuar admisión');
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
      'a[href*="/admissions/applications/application-a"]',
    );
    expect(link.getAttribute('href')).toContain('/admissions/applications/application-a');
    expect(link.getAttribute('href')).toContain('yearId=year-active');
  });
  it('preserves distinct inquiries with the same phone for siblings', () => {
    page.inquiries.set([row, { ...row, publicUuid: 'sibling', gradePublicUuid: 'grade-two' }]);
    page.searchTerm.set('987654321');
    expect(page.filteredInquiries().length).toBe(2);
  });
  it('shows the destination year rather than the inquiry year in the formalization heading', () => {
    page.openConvert(row);
    page.draftYearUuid = 'year-planning';
    fixture.detectChanges();
    expect(page.selectedYearName()).toBe('2027');
    expect(
      fixture.nativeElement.querySelector('#convert-title').parentElement.textContent,
    ).toContain('2027');
  });
  it('does not silently discard a modified application', async () => {
    page.openConvert(row);
    page.draft.studentFirstName = 'Nombre capturado';
    const confirm = spyOn(TestBed.inject(ConfirmDialogService), 'open').and.resolveTo(false);
    page.closeConvert();
    expect(confirm).toHaveBeenCalled();
    await fixture.whenStable();
    expect(page.convertInquiry()).not.toBeNull();
  });
  it('opens the created application immediately after conversion', () => {
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    api.convertInquiry.and.returnValue(
      of({
        success: true,
        data: {
          publicUuid: 'created',
          academicYearPublicUuid: 'year-planning',
        } as import('../models').AdmissionApplication,
      }),
    );
    page.openConvert(row);
    page.convert();
    expect(navigate).toHaveBeenCalledWith(['/admissions/applications', 'created'], {
      queryParams: { yearId: 'year-planning' },
    });
    expect(page.convertInquiry()).toBeNull();
  });
  it('filters pending follow-ups without treating closed or converted inquiries as pending', () => {
    page.inquiries.set([
      { ...row, nextAttentionDate: '2020-01-01' },
      { ...row, publicUuid: 'closed', status: 'CLOSED', nextAttentionDate: '2020-01-01' },
    ]);
    page.overdueSignal.set(true);
    expect(page.filteredInquiries().map((i) => i.publicUuid)).toEqual(['inquiry-a']);
  });
});
