import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EnrollmentStatusBadgeComponent } from './enrollment-status-badge.component';
import { EnrollmentStatus } from '@core/enums';

describe('EnrollmentStatusBadgeComponent', () => {
  let component: EnrollmentStatusBadgeComponent;
  let fixture: ComponentFixture<EnrollmentStatusBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EnrollmentStatusBadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EnrollmentStatusBadgeComponent);
    component = fixture.componentInstance;
  });

  it('muestra label en español para Enrolled', () => {
    fixture.componentRef.setInput('status', EnrollmentStatus.Enrolled);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Matriculado');
  });

  it('muestra label en español para Withdrawn', () => {
    fixture.componentRef.setInput('status', EnrollmentStatus.Withdrawn);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Retirado');
  });

  it('aplica clase badge-success para Enrolled', () => {
    fixture.componentRef.setInput('status', EnrollmentStatus.Enrolled);
    fixture.detectChanges();
    const span = fixture.nativeElement.querySelector('span');
    expect(span.className).toContain('badge-success');
  });

  it('fallback a status raw para valores desconocidos', () => {
    fixture.componentRef.setInput('status', 'UNKNOWN' as any);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('UNKNOWN');
    expect(fixture.nativeElement.querySelector('span').className).toContain('badge-neutral');
  });
});
