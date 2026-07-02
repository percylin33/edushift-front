import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GradeDialogComponent } from './grade-dialog.component';

describe('GradeDialogComponent', () => {
  let component: GradeDialogComponent;
  let fixture: ComponentFixture<GradeDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GradeDialogComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(GradeDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('mode', 'Grade');
    fixture.componentRef.setInput('maxScore', 20);
    fixture.detectChanges();
  });

  it('se crea en modo Grade', () => {
    expect(component).toBeTruthy();
    const title = fixture.nativeElement.querySelector('h2');
    expect(title.textContent).toContain('Calificar entrega');
  });

  it('muestra "Devolver para re-entrega" en modo Return', () => {
    fixture.componentRef.setInput('mode', 'Return');
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector('h2');
    expect(title.textContent).toContain('Devolver');
  });

  it('emite grade al submit en modo Grade', () => {
    spyOn(component.grade, 'emit');
    component.form.patchValue({ grade: 15, feedback: 'Bien' });
    component.onSubmit();
    expect(component.grade.emit).toHaveBeenCalledWith({ grade: 15, feedback: 'Bien' });
  });

  it('emite return al submit en modo Return', () => {
    spyOn(component.return, 'emit');
    fixture.componentRef.setInput('mode', 'Return');
    fixture.detectChanges();
    component.form.patchValue({ feedback: 'Corrige' });
    component.onSubmit();
    expect(component.return.emit).toHaveBeenCalledWith({ feedback: 'Corrige' });
  });

  it('no emite si form inválido', () => {
    spyOn(component.grade, 'emit');
    component.form.get('grade')!.setValue(-1);
    component.onSubmit();
    expect(component.grade.emit).not.toHaveBeenCalled();
  });

  it('emite cancelled al cancelar', () => {
    spyOn(component.cancelled, 'emit');
    component.onCancel();
    expect(component.cancelled.emit).toHaveBeenCalled();
  });

  it('no se renderiza si open es false', () => {
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeNull();
  });
});
