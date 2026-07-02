import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SubmissionListComponent } from './submission-list.component';
import { SubmissionRow, SubmissionStatus } from '../../models';
import { IconComponent } from '@shared/components';
import { HasPermissionDirective } from '@shared/directives';
import { Permission } from '@core/enums';

describe('SubmissionListComponent', () => {
  let component: SubmissionListComponent;
  let fixture: ComponentFixture<SubmissionListComponent>;
  let rows: SubmissionRow[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubmissionListComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(SubmissionListComponent);
    component = fixture.componentInstance;
    rows = [
      {
        publicUuid: 'sub-1',
        studentPublicUuid: 'st-1',
        studentFullName: 'Juan Pérez',
        studentAvatarUrl: null,
        status: SubmissionStatus.Submitted,
        version: 1,
        submittedAt: new Date('2026-01-15T10:00:00Z'),
        grade: null,
        hasAttachment: true,
      },
    ];
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('renderiza tabla con rows', () => {
    const table = fixture.nativeElement.querySelector('table');
    expect(table).toBeTruthy();
    const cells = fixture.nativeElement.querySelectorAll('td');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('renderiza empty state cuando no hay rows', () => {
    fixture.componentRef.setInput('rows', []);
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('app-icon');
    expect(icon).toBeTruthy();
  });

  it('renderiza skeleton cuando loading', () => {
    fixture.componentRef.setInput('rows', []);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    const skeleton = fixture.nativeElement.querySelector('.animate-pulse');
    expect(skeleton).toBeTruthy();
  });

  it('canGrade retorna true para Submitted, Late, Returned', () => {
    expect(component.canGrade(SubmissionStatus.Submitted)).toBeTrue();
    expect(component.canGrade(SubmissionStatus.Late)).toBeTrue();
    expect(component.canGrade(SubmissionStatus.Returned)).toBeTrue();
    expect(component.canGrade(SubmissionStatus.Graded)).toBeFalse();
    expect(component.canGrade(SubmissionStatus.Pending)).toBeFalse();
  });

  it('canReturn true solo para Graded', () => {
    expect(component.canReturn(SubmissionStatus.Graded)).toBeTrue();
    expect(component.canReturn(SubmissionStatus.Submitted)).toBeFalse();
  });

  it('emite grade al hacer click', () => {
    spyOn(component.grade, 'emit');
    component.onGrade(rows[0]);
    expect(component.grade.emit).toHaveBeenCalledWith(rows[0]);
  });

  it('emite return al hacer click', () => {
    spyOn(component.return, 'emit');
    component.onReturn(rows[0]);
    expect(component.return.emit).toHaveBeenCalledWith(rows[0]);
  });

  it('initials extrae 2 iniciales', () => {
    expect(component.initials('Juan Pérez')).toBe('JP');
    expect(component.initials('María')).toBe('M');
  });

  it('statusLabel retorna español', () => {
    expect(component.statusLabel(SubmissionStatus.Graded)).toBe('Calificada');
    expect(component.statusLabel(SubmissionStatus.Late)).toBe('Tarde');
  });
});
