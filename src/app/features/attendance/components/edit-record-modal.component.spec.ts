import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { EditRecordModalComponent } from './edit-record-modal.component';
import { AuthService } from '@core/services';
import { UserRole } from '@core/enums';
import { AttendanceRecord } from '../models';

describe('EditRecordModalComponent', () => {
  let fixture: ComponentFixture<EditRecordModalComponent>;
  let component: EditRecordModalComponent;
  let roles: ReturnType<typeof signal<UserRole[]>>;
  let fakeAuth: { hasRole: (role: UserRole) => boolean };

  const record: AttendanceRecord = {
    publicUuid: 'rec-1',
    sessionPublicUuid: 'sess-1',
    studentPublicUuid: 'stu-1',
    studentFullName: 'Juan Perez',
    studentDocumentNumber: '12345678',
    status: 'ABSENT',
    occurredAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function configureModule(): void {
    roles = signal<UserRole[]>([]);
    fakeAuth = { hasRole: (role) => roles().includes(role) };
    TestBed.configureTestingModule({
      imports: [EditRecordModalComponent],
      providers: [{ provide: AuthService, useValue: fakeAuth }],
    });
    fixture = TestBed.createComponent(EditRecordModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('record', record);
    fixture.detectChanges();
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('inicia con status PRESENT y notes vacío', () => {
    configureModule();
    expect(component['status']).toBe('PRESENT');
    expect(component['notes']).toBe('');
  });

  it('statusOptions expone los 4 valores', () => {
    configureModule();
    const opts = component['statusOptions'];
    expect(opts).toHaveSize(4);
    expect(opts[0].value).toBe('PRESENT');
  });

  it('isTeacher refleja rol', () => {
    configureModule();
    expect(component['isTeacher']()).toBeFalse();
    roles.set([UserRole.Teacher]);
    expect(component['isTeacher']()).toBeTrue();
  });

  it('close emite cancelled', () => {
    configureModule();
    const cancelled = jasmine.createSpy('cancelled');
    component.cancelled.subscribe(cancelled);
    component['close']();
    expect(cancelled).toHaveBeenCalled();
  });

  it('submit emite save con status y notes', () => {
    configureModule();
    const save = jasmine.createSpy('save');
    component.save.subscribe(save);
    component['status'] = 'LATE';
    component['notes'] = 'llegó 10 min tarde';
    component['submit']();
    expect(save).toHaveBeenCalledWith({ status: 'LATE', notes: 'llegó 10 min tarde' });
  });

  it('submit trim whitespace en notes', () => {
    configureModule();
    const save = jasmine.createSpy('save');
    component.save.subscribe(save);
    component['status'] = 'EXCUSED';
    component['notes'] = '   ';
    component['submit']();
    expect(save).toHaveBeenCalledWith({ status: 'EXCUSED', notes: undefined });
  });

  it('submit sin status no emite', () => {
    configureModule();
    const save = jasmine.createSpy('save');
    component.save.subscribe(save);
    component['status'] = '' as unknown as import('../models').AttendanceRecordStatus;
    component['submit']();
    expect(save).not.toHaveBeenCalled();
  });
});
