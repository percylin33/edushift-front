import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MySubmissionsCardComponent } from './my-submissions-card.component';
import { SubmissionStatus } from '../../models';

describe('MySubmissionsCardComponent', () => {
  let component: MySubmissionsCardComponent;
  let fixture: ComponentFixture<MySubmissionsCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MySubmissionsCardComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(MySubmissionsCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea sin submission', () => {
    expect(component).toBeTruthy();
    const title = fixture.nativeElement.querySelector('h2');
    expect(title.textContent).toContain('Aún no has entregado');
  });

  it('muestra datos de submission cuando existe', () => {
    fixture.componentRef.setInput('submission', {
      publicUuid: 'sub-1',
      assignmentPublicUuid: 'a-1',
      studentPublicUuid: 'st-1',
      submittedByUserPublicUuid: 'u-1',
      submittedForStudentPublicUuid: null,
      status: SubmissionStatus.Graded,
      textContent: 'Mi respuesta',
      attachment: null,
      version: 2,
      grade: 18,
      feedback: 'Bien',
      submittedAt: new Date('2026-01-15T10:00:00Z'),
      gradedAt: new Date('2026-01-16T10:00:00Z'),
      gradedByTeacherPublicUuid: 'tch-1',
      returnedAt: null,
      returnedByTeacherPublicUuid: null,
    });
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector('h2');
    expect(title.textContent).toContain('Tu entrega');
  });

  it('emite resubmit al hacer click', () => {
    spyOn(component.resubmit, 'emit');
    fixture.componentRef.setInput('submission', {
      publicUuid: 'sub-1',
      status: SubmissionStatus.Returned,
    } as any);
    fixture.componentRef.setInput('showResubmit', true);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button');
    btn?.click();
    expect(component.resubmit.emit).toHaveBeenCalled();
  });

  it('statusLabel retorna español', () => {
    expect(component.statusLabel(SubmissionStatus.Graded)).toBe('Calificada');
  });

  it('formatSize formatea bytes', () => {
    expect(component.formatSize(1024 * 1024)).toBe('1.0 MB');
  });
});
