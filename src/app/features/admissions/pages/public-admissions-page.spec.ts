import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { PublicAdmissionsPage } from './public-admissions-page';
import { AdmissionsApiService } from '../services/admissions-api.service';

describe('Public admission inquiry phone form', () => {
  let fixture: ComponentFixture<PublicAdmissionsPage>;
  let component: PublicAdmissionsPage;
  let submitInquiry: jasmine.Spy;
  const success = { success: true, data: { reference: 'receipt-qa', status: 'RECEIVED' } };
  beforeEach(async () => {
    submitInquiry = jasmine.createSpy().and.returnValue(of(success));
    await TestBed.configureTestingModule({
      imports: [PublicAdmissionsPage],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ tenantSlug: 'colegioqa' }) } },
        },
        {
          provide: AdmissionsApiService,
          useValue: {
            publicCatalog: () =>
              of({
                success: true,
                data: {
                  tenantName: 'Colegio QA',
                  years: [{ publicUuid: 'year-qa', name: '2026' }],
                  grades: [{ publicUuid: 'grade-qa', name: '3 años', levelName: 'Inicial' }],
                },
              }),
            submitPublicInquiry: submitInquiry,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PublicAdmissionsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });
  function fill(): void {
    Object.assign(component.form, {
      contactName: 'Familia QA',
      contactValue: '987 654 321',
      academicYearPublicUuid: 'year-qa',
      gradePublicUuid: 'grade-qa',
      privacyAccepted: true,
    });
  }
  function clickSend(): void {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    button.click();
    fixture.detectChanges();
  }
  it('old offer links explain the direct school flow without requesting a response', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PublicAdmissionsPage],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ tenantSlug: 'colegioqa', token: 'retired-token' }),
            },
          },
        },
        { provide: AdmissionsApiService, useValue: { publicOffer: jasmine.createSpy() } },
      ],
    });
    const retired = TestBed.createComponent(PublicAdmissionsPage);
    retired.detectChanges();
    expect(retired.nativeElement.textContent).toContain('No necesitas confirmar');
    expect(retired.nativeElement.textContent).not.toContain('Aceptar vacante');
  });
  it('offers only a required telephone field and an actionable submit button', () => {
    expect(fixture.nativeElement.querySelector('[name="contactType"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[type="email"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[name="contactValue"]').type).toBe('tel');
    expect(fixture.nativeElement.querySelector('[name="contactValue"]').required).toBeTrue();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBeFalse();
  });
  it('marks missing name and phone in red after clicking with year, grade and privacy filled', () => {
    fill();
    component.form.contactName = '';
    component.form.contactValue = '';
    clickSend();
    expect(submitInquiry).not.toHaveBeenCalled();
    for (const name of ['contactName', 'contactValue']) {
      const input: HTMLInputElement = fixture.nativeElement.querySelector(`[name="${name}"]`);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.classList.contains('border-rose-500')).toBeTrue();
    }
    expect(fixture.nativeElement.textContent).toContain('Falta el nombre');
    expect(fixture.nativeElement.textContent).toContain('Falta el celular');
  });
  it('shows all missing fields instead of silently ignoring submit', () => {
    clickSend();
    expect(submitInquiry).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('[aria-invalid="true"]').length).toBe(5);
    expect(fixture.nativeElement.textContent).toContain('Selecciona el año');
    expect(fixture.nativeElement.textContent).toContain('Selecciona el grado');
    expect(fixture.nativeElement.textContent).toContain('Acepta el aviso');
  });
  for (const value of [
    '   ',
    '-------',
    '123456',
    '1234567890123456',
    'abc987654321',
    'family@example.test',
  ]) {
    it(`blocks an invalid telephone: ${value}`, () => {
      fill();
      component.form.contactValue = value;
      component.submit();
      expect(submitInquiry).not.toHaveBeenCalled();
      expect(component.fieldError('contactValue')).not.toBeNull();
    });
  }
  it('rejects whitespace-only family names', () => {
    fill();
    component.form.contactName = '   ';
    component.submit();
    expect(submitInquiry).not.toHaveBeenCalled();
    expect(component.fieldError('contactName')).toContain('Falta el nombre');
  });
  it('submits a valid required phone and trimmed name with PHONE fixed in the request', () => {
    fill();
    component.form.contactName = '  Familia QA  ';
    component.form.contactValue = ' +51 987 654 321 ';
    component.submit();
    expect(submitInquiry).toHaveBeenCalledOnceWith(
      'colegioqa',
      jasmine.objectContaining({
        contactName: 'Familia QA',
        contactValue: '+51 987 654 321',
        contactType: 'PHONE',
      }),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Consulta recibida');
    expect(component.receipt()).toBe('receipt-qa');
  });
  it('removes field errors when values are corrected and allows retry', () => {
    component.submit();
    fill();
    expect(component.fieldError('contactName')).toBeNull();
    expect(component.fieldError('contactValue')).toBeNull();
    component.submit();
    expect(submitInquiry).toHaveBeenCalledTimes(1);
  });
  it('prevents repeated submissions while saving', () => {
    const response = new Subject<typeof success>();
    submitInquiry.and.returnValue(response);
    fill();
    component.submit();
    component.submit();
    fixture.detectChanges();
    expect(submitInquiry).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBeTrue();
    response.next(success);
    response.complete();
    expect(component.saving()).toBeFalse();
  });
  it('keeps data and provides feedback after a server failure', () => {
    submitInquiry.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    fill();
    component.submit();
    expect(component.error()).toContain('No se pudo enviar');
    expect(component.form.contactValue).toBe('987 654 321');
    expect(component.saving()).toBeFalse();
    expect(component.receipt()).toBeNull();
  });
});
