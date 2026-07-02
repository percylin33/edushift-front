import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { SubmissionSubmitComponent } from './submission-submit.component';
import { TasksStore } from '../../store';
import { SubmissionsStore } from '../../store';
import { SubmissionStatus } from '../../models';

describe('SubmissionSubmitComponent', () => {
  let component: SubmissionSubmitComponent;
  let fixture: ComponentFixture<SubmissionSubmitComponent>;
  let mockTasksStore: jasmine.SpyObj<TasksStore>;
  let mockSubmissionsStore: jasmine.SpyObj<SubmissionsStore>;

  beforeEach(async () => {
    mockTasksStore = jasmine.createSpyObj<TasksStore>('TasksStore', ['loadDetail']);
    mockSubmissionsStore = jasmine.createSpyObj<SubmissionsStore>(
      'SubmissionsStore',
      ['create', 'update'],
      {
        error: signal(null),
        uploading: signal(false),
        uploadPercent: signal(0),
      },
    );

    mockTasksStore.loadDetail.and.returnValue(
      Promise.resolve({
        publicUuid: 'a-1',
        title: 'Tarea',
        dueAt: new Date('2030-01-01'),
        maxScore: 20,
        allowResubmissions: true,
        requiresAttachment: false,
        lifecycle: 'PUBLISHED',
        sectionPublicUuid: 's-1',
        coursePublicUuid: 'c-1',
        periodPublicUuid: 'p-1',
        description: null,
        createdByTeacherPublicUuid: 'tch-1',
        createdAt: new Date(),
        updatedAt: null,
        submissionsCount: 0,
      }),
    );

    mockSubmissionsStore.create.and.returnValue(Promise.resolve({} as any));
    mockSubmissionsStore.update.and.returnValue(Promise.resolve({} as any));

    await TestBed.configureTestingModule({
      imports: [SubmissionSubmitComponent],
      providers: [
        provideRouter([]),
        { provide: TasksStore, useValue: mockTasksStore },
        { provide: SubmissionsStore, useValue: mockSubmissionsStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubmissionSubmitComponent);
    component = fixture.componentInstance;
    component.assignmentUuid = 'a-1';
    fixture.detectChanges();
  });

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('onResubmit muestra el form', () => {
    component.showForm.set(false);
    component.onResubmit();
    expect(component.showForm()).toBeTrue();
  });

  it('onCreate llama al store', async () => {
    const payload = {
      textContent: 'Mi respuesta',
      attachment: null,
      submittedForStudentPublicUuid: null,
    };
    await component.onCreate(payload);
    expect(mockSubmissionsStore.create).toHaveBeenCalledWith('a-1', payload);
  });

  it('onUpdate llama al store', async () => {
    component.mySubmission.set({
      publicUuid: 'sub-1',
      status: SubmissionStatus.Returned,
    } as any);
    const payload = { textContent: 'Re-entrega', attachment: null };
    await component.onUpdate(payload);
    expect(mockSubmissionsStore.update).toHaveBeenCalledWith('sub-1', payload);
  });

  it('canResubmitNow true si no hay submission', () => {
    component.mySubmission.set(null);
    expect(component.canResubmitNow()).toBeTrue();
  });
});
