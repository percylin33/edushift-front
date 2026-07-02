import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { EditRecordModalComponent } from './edit-record-modal.component';
import { AuthService } from '@core/services';
import { UserRole } from '@core/enums';
import { AttendanceRecord } from '../models';

describe('EditRecordModalComponent', () => {
  let fixture: ComponentFixture<EditRecordModalComponent>;
  let component: EditRecordModalComponent;
  let fakeAuth: { hasRole: jasmine.Spy };

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
    fakeAuth = { hasRole: jasmine.createSpy('hasRole').and.returnValue(false) };
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
    expect((component as any).status).toBe('PRESENT');
    expect((component as any).notes).toBe('');
  });

  it('statusOptions expone los 4 valores', () => {
    configureModule();
    const opts = (component as any).statusOptions;
    expect(opts).toHaveSize(4);
    expect(opts[0].value).toBe('PRESENT');
  });

  it('isTeacher refleja rol', () => {
    configureModule();
    fakeAuth.hasRole.and.returnValue(false);
    expect((component as any).isTeacher()).toBeFalse();
    fakeAuth.hasRole.and.returnValue(true);
    expect((component as any).isTeacher()).toBeTrue();
  });

  it('close emite cancelled', () => {
    configureModule();
    const cancelled = jasmine.createSpy('cancelled');
    component.cancelled.subscribe(cancelled);
    (component as any).close();
    expect(cancelled).toHaveBeenCalled();
  });

  it('submit emite save con status y notes', () => {
    configureModule();
    const save = jasmine.createSpy('save');
    component.save.subscribe(save);
    (component as any).status = 'LATE';
    (component as any).notes = 'llegó 10 min tarde';
    (component as any).submit();
    expect(save).toHaveBeenCalledWith({ status: 'LATE', notes: 'llegó 10 min tarde' });
  });

  it('submit trim whitespace en notes', () => {
    configureModule();
    const save = jasmine.createSpy('save');
    component.save.subscribe(save);
    (component as any).status = 'EXCUSED';
    (component as any).notes = '   ';
    (component as any).submit();
    expect(save).toHaveBeenCalledWith({ status: 'EXCUSED', notes: undefined });
  });

  it('submit sin status no emite', () => {
    configureModule();
    const save = jasmine.createSpy('save');
    component.save.subscribe(save);
    (component as any).status = '';
    (component as any).submit();
    expect(save).not.toHaveBeenCalled();
  });
});
