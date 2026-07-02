import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AttemptStatus } from '../../models/attempt.model';
import { AttemptStatusBadgeComponent } from './attempt-status-badge.component';

describe('AttemptStatusBadgeComponent (FE-7b.2)', () => {
  let fixture: ComponentFixture<AttemptStatusBadgeComponent>;
  let component: AttemptStatusBadgeComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AttemptStatusBadgeComponent],
    });
    fixture = TestBed.createComponent(AttemptStatusBadgeComponent);
    component = fixture.componentInstance;
  });

  it('renders the Spanish label for IN_PROGRESS', () => {
    component.status = AttemptStatus.InProgress;
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent?.trim() ?? '';
    expect(text).toContain('En progreso');
  });

  it('renders the Spanish label for GRADED', () => {
    component.status = AttemptStatus.Graded;
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent?.trim() ?? '';
    expect(text).toContain('Calificado');
  });

  it('updates the label when status changes (signal-driven)', () => {
    component.status = AttemptStatus.Submitted;
    fixture.detectChanges();
    let text = (fixture.nativeElement as HTMLElement).textContent?.trim() ?? '';
    expect(text).toContain('Enviado');

    component.status = AttemptStatus.AutoGraded;
    fixture.detectChanges();
    text = (fixture.nativeElement as HTMLElement).textContent?.trim() ?? '';
    expect(text).toContain('Auto-calificado');
  });
});
