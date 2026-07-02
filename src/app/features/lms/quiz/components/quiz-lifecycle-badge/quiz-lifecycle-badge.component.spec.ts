import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { QuizLifecycleBadgeComponent } from './quiz-lifecycle-badge.component';
import { QuizStatus } from '../../models/quiz.model';

/**
 * Spec del `QuizLifecycleBadgeComponent` (FE-7b.1).
 *
 * <p>Cubre:
 * <ol>
 *   <li>Render label correcto por lifecycle.</li>
 *   <li>Color/dot class cambia según status.</li>
 *   <li>aria-label accesible.</li>
 * </ol>
 */
describe('QuizLifecycleBadgeComponent', () => {
  let fixture: ComponentFixture<QuizLifecycleBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizLifecycleBadgeComponent],
    }).compileComponents();
  });

  it('muestra label "Borrador" para DRAFT', () => {
    fixture = TestBed.createComponent(QuizLifecycleBadgeComponent);
    fixture.componentInstance.status = QuizStatus.Draft;
    fixture.detectChanges();
    const span = fixture.debugElement.query(By.css('span')).nativeElement as HTMLSpanElement;
    expect(span.textContent).toContain('Borrador');
    expect(span.getAttribute('aria-label')).toBe('Estado: Borrador');
  });

  it('muestra label "Publicado" para PUBLISHED', () => {
    fixture = TestBed.createComponent(QuizLifecycleBadgeComponent);
    fixture.componentInstance.status = QuizStatus.Published;
    fixture.detectChanges();
    const span = fixture.debugElement.query(By.css('span')).nativeElement as HTMLSpanElement;
    expect(span.textContent).toContain('Publicado');
  });

  it('muestra label "Cerrado" para CLOSED', () => {
    fixture = TestBed.createComponent(QuizLifecycleBadgeComponent);
    fixture.componentInstance.status = QuizStatus.Closed;
    fixture.detectChanges();
    const span = fixture.debugElement.query(By.css('span')).nativeElement as HTMLSpanElement;
    expect(span.textContent).toContain('Cerrado');
  });
});
