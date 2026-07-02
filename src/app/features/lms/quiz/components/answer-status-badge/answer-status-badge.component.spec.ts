import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AnswerStatus } from '../../models/attempt.model';
import { AnswerStatusBadgeComponent } from './answer-status-badge.component';

describe('AnswerStatusBadgeComponent (FE-7b.2)', () => {
  let fixture: ComponentFixture<AnswerStatusBadgeComponent>;
  let component: AnswerStatusBadgeComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AnswerStatusBadgeComponent],
    });
    fixture = TestBed.createComponent(AnswerStatusBadgeComponent);
    component = fixture.componentInstance;
  });

  it('renders the default label for Empty', () => {
    component.status = AnswerStatus.Empty;
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent?.trim() ?? '';
    expect(text).toContain('Sin responder');
  });

  it('switches to Saved when status changes', () => {
    component.status = AnswerStatus.Saved;
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent?.trim() ?? '';
    expect(text).toContain('Guardado');
  });
});
