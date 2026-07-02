import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmploymentStatusBadgeComponent } from './employment-status-badge.component';
import { EmploymentStatus } from '@core/enums';

describe('EmploymentStatusBadgeComponent', () => {
  let fixture: ComponentFixture<EmploymentStatusBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmploymentStatusBadgeComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(EmploymentStatusBadgeComponent);
  });

  it('muestra Activo para Active', () => {
    fixture.componentRef.setInput('status', EmploymentStatus.Active);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Activo');
  });

  it('aplica clase badge--active para Active', () => {
    fixture.componentRef.setInput('status', EmploymentStatus.Active);
    fixture.detectChanges();
    const span = fixture.nativeElement.querySelector('span');
    expect(span.className).toContain('badge--active');
  });

  it('aplica badge--suspend para Suspended', () => {
    fixture.componentRef.setInput('status', EmploymentStatus.Suspended);
    fixture.detectChanges();
    const span = fixture.nativeElement.querySelector('span');
    expect(span.className).toContain('badge--suspend');
  });

  it('aplica badge--terminal para Resigned', () => {
    fixture.componentRef.setInput('status', EmploymentStatus.Resigned);
    fixture.detectChanges();
    const span = fixture.nativeElement.querySelector('span');
    expect(span.className).toContain('badge--terminal');
  });
});
