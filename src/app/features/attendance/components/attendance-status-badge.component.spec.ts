import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AttendanceStatusBadgeComponent } from './attendance-status-badge.component';

describe('AttendanceStatusBadgeComponent', () => {
  let component: AttendanceStatusBadgeComponent;
  let fixture: ComponentFixture<AttendanceStatusBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttendanceStatusBadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AttendanceStatusBadgeComponent);
    component = fixture.componentInstance;
  });

  it('muestra label Presente para PRESENT', () => {
    fixture.componentRef.setInput('status', 'PRESENT');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Presente');
  });

  it('muestra label Ausente para ABSENT', () => {
    fixture.componentRef.setInput('status', 'ABSENT');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ausente');
  });

  it('muestra label Cerrada para CLOSED', () => {
    fixture.componentRef.setInput('status', 'CLOSED');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cerrada');
  });

  it('aplica badge-success para PRESENT', () => {
    fixture.componentRef.setInput('status', 'PRESENT');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('span').className).toContain('badge-success');
  });

  it('aplica badge-error para ABSENT', () => {
    fixture.componentRef.setInput('status', 'ABSENT');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('span').className).toContain('badge-error');
  });

  it('fallback para status desconocido', () => {
    fixture.componentRef.setInput('status', 'UNKNOWN');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('UNKNOWN');
    expect(fixture.nativeElement.querySelector('span').className).toContain('badge-neutral');
  });
});
