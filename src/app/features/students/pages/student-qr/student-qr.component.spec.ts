import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { StudentQrPageComponent } from './student-qr.component';
import { StudentsApiService } from '../../services';
import { AttendanceApiService } from '@features/attendance/services';
import { AuthService, NotificationService, TenantService } from '@core/services';
import { StudentDetail } from '../../models';
import { AttendanceQrInfo } from '@features/attendance/models';
import { DocumentType, EnrollmentStatus } from '@core/enums';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmDialogService } from '@shared/components/confirm-dialog/confirm-dialog.service';

@Component({ template: '', standalone: true })
class DummyComponent {}

describe('StudentQrPageComponent', () => {
  let fixture: ComponentFixture<StudentQrPageComponent>;
  let component: StudentQrPageComponent;
  let fakeStudentsApi: jasmine.SpyObj<StudentsApiService>;
  let fakeAttendanceApi: jasmine.SpyObj<AttendanceApiService>;
  let fakeTenant: { tenant: ReturnType<typeof signal<{ name: string } | null>> };
  let fakeAuth: { hasRole: jasmine.Spy; user: ReturnType<typeof signal<unknown>> };
  let fakeNotify: { success: jasmine.Spy; error: jasmine.Spy };
  let fakeConfirm: jasmine.SpyObj<ConfirmDialogService>;

  const detail: StudentDetail = {
    publicUuid: 's-1',
    firstName: 'Juan',
    lastName: 'Perez',
    fullName: 'Juan Perez',
    documentType: DocumentType.Dni,
    documentNumber: '12345678',
    enrollmentStatus: EnrollmentStatus.Enrolled,
    enrollmentDate: new Date('2026-01-01'),
  } as any;

  const qrInfo: AttendanceQrInfo = {
    studentPublicUuid: 's-1',
    issuedAt: new Date('2026-06-01'),
    previousRevokedAt: undefined,
  };

  function configureModule(id: string | null = 's-1'): void {
    TestBed.resetTestingModule();
    fakeStudentsApi = jasmine.createSpyObj<StudentsApiService>('StudentsApiService', ['get']);
    fakeAttendanceApi = jasmine.createSpyObj<AttendanceApiService>('AttendanceApiService', [
      'getQrInfo',
      'downloadQr',
      'rotateQr',
    ]);
    fakeTenant = { tenant: signal({ name: 'Acme School' }) };
    fakeAuth = {
      hasRole: jasmine.createSpy('hasRole').and.returnValue(false),
      user: signal(null),
    };
    fakeNotify = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error') };
    fakeConfirm = jasmine.createSpyObj<ConfirmDialogService>('ConfirmDialogService', ['open']);
    fakeConfirm.open.and.resolveTo(false);

    TestBed.configureTestingModule({
      imports: [StudentQrPageComponent],
      providers: [
        provideRouter([{ path: '**', component: DummyComponent }]),
        { provide: StudentsApiService, useValue: fakeStudentsApi },
        { provide: AttendanceApiService, useValue: fakeAttendanceApi },
        { provide: TenantService, useValue: fakeTenant },
        { provide: AuthService, useValue: fakeAuth },
        { provide: NotificationService, useValue: fakeNotify },
        { provide: ConfirmDialogService, useValue: fakeConfirm },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (_: string) => id } } },
        },
      ],
    });
    fixture = TestBed.createComponent(StudentQrPageComponent);
    component = fixture.componentInstance;
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('expone backRoute apuntando al listado', () => {
    configureModule();
    expect(component['backRoute']).toBe('/students');
  });

  it('ngOnInit sin id setea loadError', async () => {
    configureModule(null);
    await component.ngOnInit();
    expect(component['loadError']()).toBe('Falta el identificador del alumno.');
    expect(component['loading']()).toBeFalse();
  });

  it('ngOnInit carga student y qrInfo', async () => {
    configureModule();
    fakeStudentsApi.get.and.returnValue(of(detail));
    fakeAttendanceApi.getQrInfo.and.returnValue(of(qrInfo));
    await component.ngOnInit();
    expect(component['student']()?.fullName).toBe('Juan Perez');
    expect(component['qrInfo']()?.issuedAt).toBeInstanceOf(Date);
    expect(component['loading']()).toBeFalse();
  });

  it('ngOnInit maneja 404 con mensaje específico', async () => {
    configureModule();
    const err = new HttpErrorResponse({ status: 404 });
    fakeStudentsApi.get.and.returnValue(throwError(() => err));
    fakeAttendanceApi.getQrInfo.and.returnValue(throwError(() => err));
    await component.ngOnInit();
    expect(component['loadError']()).toContain('No encontramos al alumno');
  });

  it('ngOnInit maneja error genérico con mensaje genérico', async () => {
    configureModule();
    fakeStudentsApi.get.and.returnValue(throwError(() => ({ status: 500 })));
    fakeAttendanceApi.getQrInfo.and.returnValue(of(qrInfo));
    await component.ngOnInit();
    expect(component['loadError']()).toContain('error');
  });

  it('reload dispara loadStudentAndQrMetadata', async () => {
    configureModule();
    fakeStudentsApi.get.and.returnValue(of(detail));
    fakeAttendanceApi.getQrInfo.and.returnValue(of(qrInfo));
    await component.ngOnInit();
    component['publicUuid'].set('s-1');
    await component['reload']();
    expect(fakeStudentsApi.get).toHaveBeenCalled();
  });

  it('issueAndDownload emite éxito y actualiza qrInfo', async () => {
    configureModule();
    fakeStudentsApi.get.and.returnValue(of(detail));
    fakeAttendanceApi.getQrInfo.and.returnValue(of(qrInfo));
    await component.ngOnInit();
    const blob = new Blob(['<svg/>'], { type: 'image/svg+xml' });
    fakeAttendanceApi.downloadQr.and.returnValue(of(blob));
    spyOn(URL, 'createObjectURL').and.returnValue('blob:fake');
    spyOn(URL, 'revokeObjectURL');
    await component['issueAndDownload']('svg');
    expect(fakeNotify.success).toHaveBeenCalled();
    expect(fakeAttendanceApi.getQrInfo).toHaveBeenCalled();
  });

  it('issueAndDownload maneja error y notifica', async () => {
    configureModule();
    fakeStudentsApi.get.and.returnValue(of(detail));
    fakeAttendanceApi.getQrInfo.and.returnValue(of(qrInfo));
    await component.ngOnInit();
    fakeAttendanceApi.downloadQr.and.returnValue(throwError(() => new Error('boom')));
    await component['issueAndDownload']('png');
    expect(fakeNotify.error).toHaveBeenCalled();
  });

  it('issueAndDownload no dispara si busy', async () => {
    configureModule();
    component['issuingFormat'].set('svg');
    await component['issueAndDownload']('png');
    expect(fakeAttendanceApi.downloadQr).not.toHaveBeenCalled();
  });

  it('rotate requiere canRotate', async () => {
    configureModule();
    fakeAuth.hasRole.and.returnValue(false);
    await component['rotate']();
    expect(fakeAttendanceApi.rotateQr).not.toHaveBeenCalled();
  });

  it('rotate confirmado llama al API y refresca', async () => {
    configureModule();
    fakeAuth.hasRole.and.returnValue(true);
    fakeStudentsApi.get.and.returnValue(of(detail));
    fakeAttendanceApi.getQrInfo.and.returnValue(of(qrInfo));
    await component.ngOnInit();
    fakeConfirm.open.and.resolveTo(true);
    fakeAttendanceApi.rotateQr.and.returnValue(of({ ...qrInfo }));
    await component['rotate']();
    expect(fakeAttendanceApi.rotateQr).toHaveBeenCalled();
    expect(fakeNotify.success).toHaveBeenCalled();
  });

  it('rotate cancelado por usuario no llama API', async () => {
    configureModule();
    fakeAuth.hasRole.and.returnValue(true);
    fakeConfirm.open.and.resolveTo(false);
    await component['rotate']();
    expect(fakeAttendanceApi.rotateQr).not.toHaveBeenCalled();
  });

  it('rotate maneja error', async () => {
    configureModule();
    fakeAuth.hasRole.and.returnValue(true);
    fakeStudentsApi.get.and.returnValue(of(detail));
    fakeAttendanceApi.getQrInfo.and.returnValue(of(qrInfo));
    await component.ngOnInit();
    fakeConfirm.open.and.resolveTo(true);
    fakeAttendanceApi.rotateQr.and.returnValue(throwError(() => new Error('x')));
    await component['rotate']();
    expect(fakeNotify.error).toHaveBeenCalled();
  });

  it('formatDate formatea en es', () => {
    configureModule();
    const formatted = component['formatDate'](new Date('2026-06-15T10:30'));
    expect(formatted).toContain('2026');
  });

  it('canRotate / hasActiveQr / busy reflejan signals', () => {
    configureModule();
    fakeAuth.hasRole.and.returnValue(true);
    expect(component['canRotate']()).toBeTrue();
    expect(component['hasActiveQr']()).toBeFalse();
    expect(component['busy']()).toBeFalse();
    component['qrInfo'].set(qrInfo);
    expect(component['hasActiveQr']()).toBeTrue();
    component['rotating'].set(true);
    expect(component['busy']()).toBeTrue();
  });
});
