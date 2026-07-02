import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuestionTypeBadgeComponent } from './question-type-badge.component';
import { QuestionType } from '../../models/quiz.model';

describe('QuestionTypeBadgeComponent', () => {
  let component: QuestionTypeBadgeComponent;
  let fixture: ComponentFixture<QuestionTypeBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuestionTypeBadgeComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(QuestionTypeBadgeComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('type', QuestionType.MultipleChoice);
    fixture.detectChanges();
  });

  it('se crea con type MultipleChoice', () => {
    expect(component).toBeTruthy();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.textContent?.trim()).toContain('Opción múltiple');
  });

  it('muestra label correcto para TrueFalse', () => {
    fixture.componentRef.setInput('type', QuestionType.TrueFalse);
    fixture.detectChanges();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.textContent?.trim()).toContain('Verdadero');
  });

  it('muestra label correcto para ShortAnswer', () => {
    fixture.componentRef.setInput('type', QuestionType.ShortAnswer);
    fixture.detectChanges();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.textContent?.trim()).toContain('Respuesta corta');
  });

  it('aria-label refleja el tipo', () => {
    fixture.componentRef.setInput('type', QuestionType.MultipleChoice);
    fixture.detectChanges();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.getAttribute('aria-label')).toContain('Opción múltiple');
  });
});
