import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SubmissionGradeComponent } from './submission-grade.component';
import { TasksStore } from '../../store';
import { SubmissionsStore } from '../../store';
import { SubmissionRow, SubmissionStatus } from '../../models';

describe('SubmissionGradeComponent', () => {
  let component: SubmissionGradeComponent;
  let fixture: ComponentFixture<SubmissionGradeComponent>;
  let mockTasksStore: jasmine.SpyObj<TasksStore>;
  let mockSubmissionsStore: jasmine.SpyObj<SubmissionsStore>;

  beforeEach(async () => {
    mockTasksStore = jasmine.createSpyObj<TasksStore>('TasksStore', ['loadDetail'], {
      selected: signal(null),
      loadingDetail: signal(false),
      error: signal(null),
    });

    mockSubmissionsStore = jasmine.createSpyObj<SubmissionsStore>(
      'SubmissionsStore',
      ['loadByAssignment', 'grade', 'return'],
      {
        rows: signal([]),
        loading: signal(false),
        error: signal(null),
      },
    );

    mockTasksStore.loadDetail.and.returnValue(
      Promise.resolve({
        publicUuid: 'a-1',
        maxScore: 20,
      } as any),
    );
    mockSubmissionsStore.loadByAssignment.and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      imports: [SubmissionGradeComponent],
      providers: [
        provideRouter([]),
        { provide: TasksStore, useValue: mockTasksStore },
        { provide: SubmissionsStore, useValue: mockSubmissionsStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubmissionGradeComponent);
    component = fixture.componentInstance;
    component['assignmentUuid'] = 'a-1';
    fixture.detectChanges();
  });

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('onOpenGrade setea modo Grade', () => {
    const row: SubmissionRow = {
      publicUuid: 'sub-1',
      studentPublicUuid: 'st-1',
      studentFullName: 'Juan',
      studentAvatarUrl: null,
      status: SubmissionStatus.Submitted,
      version: 1,
      submittedAt: new Date(),
      grade: null,
      hasAttachment: false,
    };
    component.onOpenGrade(row);
    expect(component.dialogMode()).toBe('Grade');
    expect(component.dialogOpen()).toBeTrue();
  });

  it('onOpenReturn setea modo Return', () => {
    const row: SubmissionRow = {
      publicUuid: 'sub-1',
      studentPublicUuid: 'st-1',
      studentFullName: 'Juan',
      studentAvatarUrl: null,
      status: SubmissionStatus.Graded,
      version: 1,
      submittedAt: new Date(),
      grade: 15,
      hasAttachment: false,
    };
    component.onOpenReturn(row);
    expect(component.dialogMode()).toBe('Return');
    expect(component.dialogOpen()).toBeTrue();
  });

  it('onCancelDialog cierra dialog', () => {
    component.dialogOpen.set(true);
    component.onCancelDialog();
    expect(component.dialogOpen()).toBeFalse();
  });

  it('onConfirmGrade llama al store', async () => {
    mockSubmissionsStore.grade.and.returnValue(Promise.resolve({} as any));
    component.selectedRow = {
      publicUuid: 'sub-1',
      studentPublicUuid: 'st-1',
      studentFullName: 'Juan',
      studentAvatarUrl: null,
      status: SubmissionStatus.Submitted,
      version: 1,
      submittedAt: new Date(),
      grade: null,
      hasAttachment: false,
    };
    await component.onConfirmGrade({ grade: 15, feedback: 'Bien' });
    expect(mockSubmissionsStore.grade).toHaveBeenCalledWith('sub-1', {
      grade: 15,
      feedback: 'Bien',
    });
  });

  it('onConfirmReturn llama al store', async () => {
    mockSubmissionsStore.return.and.returnValue(Promise.resolve({} as any));
    component.selectedRow = {
      publicUuid: 'sub-1',
      studentPublicUuid: 'st-1',
      studentFullName: 'Juan',
      studentAvatarUrl: null,
      status: SubmissionStatus.Graded,
      version: 1,
      submittedAt: new Date(),
      grade: 15,
      hasAttachment: false,
    };
    await component.onConfirmReturn({ feedback: 'revisa' });
    expect(mockSubmissionsStore.return).toHaveBeenCalledWith('sub-1', { feedback: 'revisa' });
  });
});

import { signal } from '@angular/core';
