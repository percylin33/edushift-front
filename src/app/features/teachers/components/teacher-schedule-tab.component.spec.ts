import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TeacherScheduleTabComponent } from './teacher-schedule-tab.component';
import { AcademicApiService } from '@features/academic/services';
import { ScheduleApiService } from '@features/schedule/services/schedule-api.service';
import { TeachersApiService } from '../services';
import { AuthService } from '@core/services';
import { UserRole } from '@core/enums';

describe('TeacherScheduleTabComponent', () => {
  let fixture: ComponentFixture<TeacherScheduleTabComponent>;
  let component: TeacherScheduleTabComponent;
  let fakeAcademic: jasmine.SpyObj<AcademicApiService>;
  let fakeSchedule: jasmine.SpyObj<ScheduleApiService>;
  let fakeTeachers: jasmine.SpyObj<TeachersApiService>;
  let fakeAuth: { hasRole: jasmine.Spy };

  function configureModule(isAdmin = false): void {
    fakeAcademic = jasmine.createSpyObj<AcademicApiService>('AcademicApiService', [
      'getTeacherSchedule',
    ]);
    fakeSchedule = jasmine.createSpyObj<ScheduleApiService>('ScheduleApiService', [
      'getTeacherScheduleWeek',
    ]);
    fakeTeachers = jasmine.createSpyObj<TeachersApiService>('TeachersApiService', [
      'listAssignments',
    ]);
    fakeAuth = {
      hasRole: jasmine.createSpy('hasRole').and.callFake((role: UserRole) =>
        isAdmin ? role === UserRole.TenantAdmin : false,
      ),
    };
    TestBed.configureTestingModule({
      imports: [TeacherScheduleTabComponent],
      providers: [
        { provide: AcademicApiService, useValue: fakeAcademic },
        { provide: ScheduleApiService, useValue: fakeSchedule },
        { provide: TeachersApiService, useValue: fakeTeachers },
        { provide: AuthService, useValue: fakeAuth },
      ],
    });
    fixture = TestBed.createComponent(TeacherScheduleTabComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('teacherPublicUuid', 't-1');
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnChanges carga horario (teacher)', async () => {
    configureModule(false);
    fakeSchedule.getTeacherScheduleWeek.and.returnValue(
      of({ slots: [], nonTeachingBlocks: [], suggestedPeriods: [] }),
    );
    const changes = {
      teacherPublicUuid: { previousValue: undefined, currentValue: 't-1', firstChange: true },
    };
    (component as any).ngOnChanges(changes);
    await Promise.resolve();
    expect(fakeSchedule.getTeacherScheduleWeek).toHaveBeenCalledWith('t-1');
  });

  it('loadSchedule guarda slots en éxito', async () => {
    configureModule(false);
    fakeSchedule.getTeacherScheduleWeek.and.returnValue(
      of({
        slots: [{ slotPublicUuid: 'slot-1', dayOfWeek: 1, startTime: '08:00', endTime: '09:00' } as any],
        nonTeachingBlocks: [],
        suggestedPeriods: [],
      }),
    );
    await (component as any).loadAll();
    expect((component as any).slots()).toHaveSize(1);
    expect((component as any).loading()).toBeFalse();
  });

  it('loadSchedule maneja error y setea mensaje', async () => {
    configureModule(false);
    fakeSchedule.getTeacherScheduleWeek.and.returnValue(throwError(() => new Error('boom')));
    fakeAcademic.getTeacherSchedule.and.returnValue(throwError(() => new Error('boom')));
    await (component as any).loadAll();
    expect((component as any).errorMessage()).toBe('boom');
    expect((component as any).loading()).toBeFalse();
  });

  it('retry recarga horario', async () => {
    configureModule(false);
    fakeSchedule.getTeacherScheduleWeek.and.returnValue(
      of({ slots: [], nonTeachingBlocks: [], suggestedPeriods: [] }),
    );
    await (component as any).retry();
    expect(fakeSchedule.getTeacherScheduleWeek).toHaveBeenCalled();
  });

  it('admin carga week + assignments', async () => {
    configureModule(true);
    fakeSchedule.getTeacherScheduleWeek.and.returnValue(
      of({ slots: [], nonTeachingBlocks: [], suggestedPeriods: [] }),
    );
    fakeTeachers.listAssignments.and.returnValue(of([]));
    await (component as any).loadAll();
    expect(fakeTeachers.listAssignments).toHaveBeenCalledWith('t-1', { active: true });
  });
});
