import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TeacherScheduleTabComponent } from './teacher-schedule-tab.component';
import { AcademicApiService } from '@features/academic/services';

describe('TeacherScheduleTabComponent', () => {
  let fixture: ComponentFixture<TeacherScheduleTabComponent>;
  let component: TeacherScheduleTabComponent;
  let fakeAcademic: jasmine.SpyObj<AcademicApiService>;

  function configureModule(): void {
    fakeAcademic = jasmine.createSpyObj<AcademicApiService>('AcademicApiService', [
      'getTeacherSchedule',
    ]);
    TestBed.configureTestingModule({
      imports: [TeacherScheduleTabComponent],
      providers: [{ provide: AcademicApiService, useValue: fakeAcademic }],
    });
    fixture = TestBed.createComponent(TeacherScheduleTabComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('teacherPublicUuid', 't-1');
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnChanges carga horario', async () => {
    configureModule();
    fakeAcademic.getTeacherSchedule.and.returnValue(of([]));
    const changes = {
      teacherPublicUuid: { previousValue: undefined, currentValue: 't-1', firstChange: true },
    };
    (component as any).ngOnChanges(changes);
    await Promise.resolve();
    expect(fakeAcademic.getTeacherSchedule).toHaveBeenCalledWith('t-1');
  });

  it('loadSchedule guarda slots en éxito', async () => {
    configureModule();
    fakeAcademic.getTeacherSchedule.and.returnValue(
      of([{ publicUuid: 'slot-1', dayOfWeek: 1, startTime: '08:00', endTime: '09:00' } as any]),
    );
    await (component as any).loadSchedule();
    expect((component as any).slots()).toHaveSize(1);
    expect((component as any).loading()).toBeFalse();
  });

  it('loadSchedule maneja error y setea mensaje', async () => {
    configureModule();
    fakeAcademic.getTeacherSchedule.and.returnValue(throwError(() => new Error('boom')));
    await (component as any).loadSchedule();
    expect((component as any).errorMessage()).toBe('boom');
    expect((component as any).loading()).toBeFalse();
  });

  it('retry recarga horario', async () => {
    configureModule();
    fakeAcademic.getTeacherSchedule.and.returnValue(of([]));
    await (component as any).retry();
    expect(fakeAcademic.getTeacherSchedule).toHaveBeenCalled();
  });
});
