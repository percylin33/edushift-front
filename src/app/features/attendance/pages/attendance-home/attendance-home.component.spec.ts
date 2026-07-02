import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AttendanceHomeComponent } from './attendance-home.component';
import { ROUTES } from '@core/constants';

describe('AttendanceHomeComponent', () => {
  let fixture: ComponentFixture<AttendanceHomeComponent>;
  let component: AttendanceHomeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttendanceHomeComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(AttendanceHomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('expone scannerRoute y sessionsRoute', () => {
    expect((component as any).scannerRoute).toBe(ROUTES.ATTENDANCE.SCANNER);
    expect((component as any).sessionsRoute).toBe(ROUTES.ATTENDANCE.SESSIONS);
  });

  it('renderiza título', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Asistencia');
  });
});
