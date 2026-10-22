import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { AdmissionDetailPanelComponent } from './admission-detail-panel.component';
import { AdmissionsApiService } from '../services/admissions-api.service';
import { AdmissionApplicationDetail, AdmissionDetailDecision, AdmissionStatus } from '../models';

import { detailFixture } from './admission-detail.fixture';

describe('Admission detail panel', () => {
  let fixture: ComponentFixture<AdmissionDetailPanelComponent>;
  let api: jasmine.SpyObj<AdmissionsApiService>;
  beforeEach(async () => {
    api = jasmine.createSpyObj<AdmissionsApiService>('api', ['detail', 'transition']);
    api.detail.and.returnValue(of({ success: true, data: detailFixture }));
    await TestBed.configureTestingModule({
      imports: [AdmissionDetailPanelComponent],
      providers: [provideRouter([]), { provide: AdmissionsApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(AdmissionDetailPanelComponent);
    fixture.componentRef.setInput('applicationUuid', 'application');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });
  const text = (element: HTMLElement): string => element.textContent ?? '';
  it('shows student, guardian, original inquiry and both histories without changing state', () => {
    const content = text(fixture.nativeElement);
    for (const value of [
      '90000101',
      'Madre QA',
      '90000201',
      '987654321',
      'Presencial: visita',
      'Solicitud creada',
      'Presencial',
      '2026',
    ])
      expect(content).toContain(value);
    expect(api.detail).toHaveBeenCalledWith('application');
    expect(api.transition).not.toHaveBeenCalled();
    expect(content).not.toContain('Iniciar revisión');
    expect(content).not.toContain('Completar matrícula');
  });
  it('starts review only through the explicit action available to a decision maker', () => {
    const emitted = jasmine.createSpy<(value: AdmissionDetailDecision) => void>();
    fixture.componentInstance.decision.subscribe(emitted);
    fixture.componentRef.setInput('canDecide', true);
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    buttons.find((button) => button.textContent?.includes('Iniciar revisión'))!.click();
    expect(emitted).toHaveBeenCalledWith({
      application: detailFixture.application,
      status: 'UNDER_REVIEW',
    });
    expect(api.transition).not.toHaveBeenCalled();
  });
  it('shows decisions only after entering review and respects the busy state', () => {
    api.detail.and.returnValue(
      of({
        success: true,
        data: {
          ...detailFixture,
          application: { ...detailFixture.application, status: 'UNDER_REVIEW' },
        },
      }),
    );
    fixture.componentRef.setInput('canDecide', true);
    fixture.componentRef.setInput('reload', 1);
    fixture.detectChanges();
    expect(text(fixture.nativeElement)).toContain('Admitir');
    expect(text(fixture.nativeElement)).toContain('Rechazar');
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('footer button'),
    );
    expect(buttons.every((button) => button.disabled)).toBeTrue();
  });
  for (const status of ['ENROLLED', 'REJECTED', 'WITHDRAWN'] as AdmissionStatus[]) {
    it(`keeps ${status} viewable without offering further decisions`, () => {
      api.detail.and.returnValue(
        of({
          success: true,
          data: { ...detailFixture, application: { ...detailFixture.application, status } },
        }),
      );
      fixture.componentRef.setInput('canDecide', true);
      fixture.componentRef.setInput('canEnroll', true);
      fixture.componentRef.setInput('reload', 1);
      fixture.detectChanges();
      expect(text(fixture.nativeElement)).toContain('90000101');
      expect(fixture.nativeElement.querySelector('footer button')).toBeNull();
    });
  }
  it('explains missing legacy data without an empty or broken screen', () => {
    api.detail.and.returnValue(
      of({
        success: true,
        data: {
          ...detailFixture,
          guardians: [],
          inquiry: null,
          history: [],
          student: {
            fullName: null,
            documentNumber: null,
            documentType: null,
            birthDate: null,
            gender: null,
          },
        },
      }),
    );
    fixture.componentRef.setInput('reload', 1);
    fixture.detectChanges();
    expect(text(fixture.nativeElement)).toContain('Sin datos registrados');
    expect(text(fixture.nativeElement)).toContain('Sin consulta pública vinculada');
    expect(text(fixture.nativeElement)).toContain('no tiene datos de apoderado');
  });
  for (const status of [403, 404, 500]) {
    it(`clears previous personal data and supports retry after HTTP ${status}`, () => {
      api.detail.and.returnValue(throwError(() => new HttpErrorResponse({ status })));
      fixture.componentRef.setInput('reload', 1);
      fixture.detectChanges();
      expect(text(fixture.nativeElement)).not.toContain('90000101');
      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
      api.detail.and.returnValue(of({ success: true, data: detailFixture }));
      const retry: HTMLButtonElement = fixture.nativeElement.querySelector('[role="alert"] button');
      retry.click();
      fixture.detectChanges();
      expect(text(fixture.nativeElement)).toContain('90000101');
    });
  }
  it('cancels an old request when another application is opened', () => {
    const first = new Subject<{ success: boolean; data: AdmissionApplicationDetail }>();
    const second = new Subject<{ success: boolean; data: AdmissionApplicationDetail }>();
    api.detail.and.returnValues(first, second);
    fixture.componentRef.setInput('applicationUuid', 'first');
    fixture.detectChanges();
    fixture.componentRef.setInput('applicationUuid', 'second');
    fixture.detectChanges();
    first.next({ success: true, data: detailFixture });
    fixture.detectChanges();
    expect(text(fixture.nativeElement)).not.toContain('90000101');
    second.next({
      success: true,
      data: {
        ...detailFixture,
        student: { ...detailFixture.student, fullName: 'Otro alumno', documentNumber: '90000102' },
      },
    });
    fixture.detectChanges();
    expect(text(fixture.nativeElement)).toContain('90000102');
    expect(text(fixture.nativeElement)).not.toContain('90000101');
  });
});
