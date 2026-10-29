import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { WithdrawEnrollmentModalComponent } from './withdraw-enrollment-modal.component';
import { StudentsStore } from '../store/students.store';
import { EnrollmentRow } from '../models';
import { StudentEnrollmentStatus } from '@core/enums';

describe('WithdrawEnrollmentModalComponent', () => {
  let fixture: ComponentFixture<WithdrawEnrollmentModalComponent>;
  let component: WithdrawEnrollmentModalComponent;
  let fakeStore: {
    savingEnrollment: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    clearError: jasmine.Spy;
    withdrawEnrollment: jasmine.Spy;
  };

  const enrollment: EnrollmentRow = {
    publicUuid: 'e-1',
    studentPublicUuid: 's-1',
    studentFullName: 'Juan',
    sectionPublicUuid: 'sec-1',
    sectionName: 'A',
    gradeName: null,
    academicYearPublicUuid: 'y-1',
    academicYearName: '2026',
    enrolledAt: new Date('2026-01-15'),
    withdrawnAt: undefined,
    status: StudentEnrollmentStatus.Active,
    active: true,
  };

  function configureModule(): void {
    fakeStore = {
      savingEnrollment: signal(false),
      error: signal<string | null>(null),
      clearError: jasmine.createSpy('clearError'),
      withdrawEnrollment: jasmine
        .createSpy('withdrawEnrollment')
        .and.returnValue(Promise.resolve(null)),
    };
    TestBed.configureTestingModule({
      imports: [WithdrawEnrollmentModalComponent],
      providers: [{ provide: StudentsStore, useValue: fakeStore }],
    });
    fixture = TestBed.createComponent(WithdrawEnrollmentModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('enrollment', enrollment);
    fixture.detectChanges();
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnInit setea fecha default a hoy si >= enrolledAt', () => {
    configureModule();
    expect(component['withdrawnAt']()).toBeTruthy();
    expect(component['status']()).toBe(StudentEnrollmentStatus.Withdrawn);
  });

  it('minDate retorna ISO de enrolledAt', () => {
    configureModule();
    expect(component['minDate']()).toBe('2026-01-15');
  });

  it('canSubmit false sin fecha', () => {
    configureModule();
    component['withdrawnAt'].set('');
    expect(component['canSubmit']()).toBeFalse();
  });

  it('canSubmit true con fecha válida posterior al enrolledAt', () => {
    configureModule();
    component['withdrawnAt'].set('2026-02-01');
    expect(component['canSubmit']()).toBeTrue();
  });

  it('canSubmit false si fecha anterior al enrolledAt', () => {
    configureModule();
    component['withdrawnAt'].set('2025-12-31');
    expect(component['canSubmit']()).toBeFalse();
  });

  it('statusDescription retorna copy según status', () => {
    configureModule();
    component['status'].set(StudentEnrollmentStatus.Withdrawn);
    expect(component['statusDescription']()).toContain('iniciativa propia');
    component['status'].set(StudentEnrollmentStatus.Transferred);
    expect(component['statusDescription']()).toContain('traslada');
    component['status'].set(StudentEnrollmentStatus.Graduated);
    expect(component['statusDescription']()).toContain('terminó el ciclo');
    component['status'].set(StudentEnrollmentStatus.Active);
    expect(component['statusDescription']()).toBe('');
  });

  it('close emite closed y limpia error', () => {
    configureModule();
    const closedSpy = jasmine.createSpy('closed');
    component.closed.subscribe(closedSpy);
    component['close']();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(closedSpy).toHaveBeenCalled();
  });

  it('onSubmit no dispara si canSubmit es false', async () => {
    configureModule();
    component['withdrawnAt'].set('');
    await component['onSubmit']();
    expect(fakeStore.withdrawEnrollment).not.toHaveBeenCalled();
  });

  it('onSubmit llama store y emite withdrew', async () => {
    configureModule();
    component['withdrawnAt'].set('2026-02-01');
    component['status'].set(StudentEnrollmentStatus.Withdrawn);
    fakeStore.withdrawEnrollment.and.returnValue(Promise.resolve({ publicUuid: 'e-1' }));
    const withdrewSpy = jasmine.createSpy('withdrew');
    component.withdrew.subscribe(withdrewSpy);
    await component['onSubmit']();
    expect(fakeStore.withdrawEnrollment).toHaveBeenCalledWith('e-1', {
      status: StudentEnrollmentStatus.Withdrawn,
      withdrawnAt: '2026-02-01',
    });
    expect(withdrewSpy).toHaveBeenCalled();
  });

  it('onSubmit no emite withdrew si store retorna null', async () => {
    configureModule();
    component['withdrawnAt'].set('2026-02-01');
    fakeStore.withdrawEnrollment.and.returnValue(Promise.resolve(null));
    const withdrewSpy = jasmine.createSpy('withdrew');
    component.withdrew.subscribe(withdrewSpy);
    await component['onSubmit']();
    expect(withdrewSpy).not.toHaveBeenCalled();
  });

  it('statusLabel retorna etiqueta en español', () => {
    configureModule();
    expect(component['statusLabel'](StudentEnrollmentStatus.Withdrawn)).toBe('Retirado');
  });

  it('terminalStatuses expone los tres estados terminales', () => {
    configureModule();
    const opts = component['terminalStatuses'];
    expect(opts).toContain(StudentEnrollmentStatus.Withdrawn);
    expect(opts).toContain(StudentEnrollmentStatus.Transferred);
    expect(opts).toContain(StudentEnrollmentStatus.Graduated);
    expect(opts).not.toContain(StudentEnrollmentStatus.Active);
  });
});
