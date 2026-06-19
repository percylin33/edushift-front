import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuizPlaceholderComponent } from './quiz-placeholder.component';
import { IconComponent } from '@shared/components';

/**
 * Sanity tests for the Quiz placeholder card (FE-7b.0).
 *
 * <p>Los placeholders son visuales por naturaleza. Estos tests
 * verifican que el contrato de <em>inputs</em> (title, kicker,
 * description, icon, permissionLabel) se renderiza correctamente —
 * el resto (colores, layout) es responsabilidad de la inspección
 * visual. Esto evita regresiones silenciosas si alguien refactoriza
 * el template sin actualizar los inputs.
 */
describe('QuizPlaceholderComponent', () => {
  let fixture: ComponentFixture<QuizPlaceholderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizPlaceholderComponent, IconComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(QuizPlaceholderComponent);
  });

  it('renders title, kicker and permission label', () => {
    fixture.componentRef.setInput('title', 'Nuevo quiz');
    fixture.componentRef.setInput('kicker', 'Sección ABC');
    fixture.componentRef.setInput('description', 'Llega en FE-7b.1');
    fixture.componentRef.setInput('icon', 'edit-2');
    fixture.componentRef.setInput('permissionLabel', 'LMS_QUIZ_CREATE');
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Nuevo quiz');
    expect(html).toContain('Sección ABC');
    expect(html).toContain('Llega en FE-7b.1');
    expect(html).toContain('LMS_QUIZ_CREATE');
    expect(html).toContain('Sprint 7b');
  });

  it('renders an app-icon element', () => {
    fixture.componentRef.setInput('title', 'Tomar quiz');
    fixture.componentRef.setInput('kicker', 'Quiz 1');
    fixture.componentRef.setInput('description', 'd');
    fixture.componentRef.setInput('icon', 'send');
    fixture.componentRef.setInput('permissionLabel', 'LMS_QUIZ_SUBMIT');
    fixture.detectChanges();

    const icon = fixture.nativeElement.querySelector('app-icon');
    expect(icon).toBeTruthy();
  });
});
