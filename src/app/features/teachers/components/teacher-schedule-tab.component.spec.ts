import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { of, throwError } from 'rxjs';
import { TeacherScheduleTabComponent } from './teacher-schedule-tab.component';
import { AcademicApiService } from '@features/academic/services';
import { ScheduleApiService } from '@features/schedule/services/schedule-api.service';
import { AuthService } from '@core/services';
import { UserRole } from '@core/enums';
import { ScheduleSlotItem } from '@features/academic/models';

describe('TeacherScheduleTabComponent', () => {
  let fixture: ComponentFixture<TeacherScheduleTabComponent>;
  let component: TeacherScheduleTabComponent;
  let fakeAcademic: jasmine.SpyObj<AcademicApiService>;
  let fakeSchedule: jasmine.SpyObj<ScheduleApiService>;
  let fakeAuth: { hasRole: jasmine.Spy };

  function configureModule(isAdmin = false): void {
    fakeAcademic = jasmine.createSpyObj<AcademicApiService>('AcademicApiService', [
      'getTeacherSchedule',
    ]);
    fakeSchedule = jasmine.createSpyObj<ScheduleApiService>('ScheduleApiService', [
      'getTeacherScheduleWeek',
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
      teacherPublicUuid: new SimpleChange(undefined, 't-1', true),
    };
    component['ngOnChanges'](changes);
    await Promise.resolve();
    expect(fakeSchedule.getTeacherScheduleWeek).toHaveBeenCalledWith('t-1');
  });

  it('loadSchedule guarda slots en éxito', async () => {
    configureModule(false);
    fakeSchedule.getTeacherScheduleWeek.and.returnValue(
      of({
        slots: [
          {
            slotPublicUuid: 'slot-1',
            assignmentPublicUuid: 'assignment-1',
            dayOfWeek: 1,
            startTime: '08:00',
            endTime: '09:00',
            course: { publicUuid: 'course-1', code: 'MATH-101', name: 'Matemática' },
            period: { publicUuid: 'period-1', periodType: 'BIMESTER', ordinal: 1, name: 'Bimestre 1' },
          } satisfies ScheduleSlotItem,
        ],
        nonTeachingBlocks: [],
        suggestedPeriods: [],
      }),
    );
    await component['loadAll']();
    expect(component['slots']()).toHaveSize(1);
    expect(component['loading']()).toBeFalse();
  });

  it('loadSchedule maneja error y setea mensaje', async () => {
    configureModule(false);
    fakeSchedule.getTeacherScheduleWeek.and.returnValue(throwError(() => new Error('boom')));
    fakeAcademic.getTeacherSchedule.and.returnValue(throwError(() => new Error('boom')));
    await component['loadAll']();
    expect(component['errorMessage']()).toBe('boom');
    expect(component['loading']()).toBeFalse();
  });

  it('retry recarga horario', async () => {
    configureModule(false);
    fakeSchedule.getTeacherScheduleWeek.and.returnValue(
      of({ slots: [], nonTeachingBlocks: [], suggestedPeriods: [] }),
    );
    await component['retry']();
    expect(fakeSchedule.getTeacherScheduleWeek).toHaveBeenCalled();
  });

  it('admin carga la vista semanal', async () => {
    configureModule(true);
    fakeSchedule.getTeacherScheduleWeek.and.returnValue(
      of({ slots: [], nonTeachingBlocks: [], suggestedPeriods: [] }),
    );
    await component['loadAll']();
    expect(fakeSchedule.getTeacherScheduleWeek).toHaveBeenCalledWith('t-1');
  });
});
