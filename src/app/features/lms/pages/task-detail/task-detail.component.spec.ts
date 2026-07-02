import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TaskDetailComponent } from './task-detail.component';
import { TasksStore } from '../../store';
import { TaskLifecycle } from '../../models';

describe('TaskDetailComponent', () => {
  let component: TaskDetailComponent;
  let fixture: ComponentFixture<TaskDetailComponent>;
  let mockStore: jasmine.SpyObj<TasksStore>;

  beforeEach(async () => {
    const detail = {
      publicUuid: 't-1',
      sectionPublicUuid: 's-1',
      coursePublicUuid: 'c-1',
      periodPublicUuid: 'p-1',
      title: 'Tarea 1',
      description: 'Desc',
      dueAt: null,
      maxScore: 20,
      allowResubmissions: true,
      requiresAttachment: false,
      lifecycle: TaskLifecycle.Draft,
      createdByTeacherPublicUuid: 'tch-1',
      createdAt: new Date(),
      updatedAt: null,
      submissionsCount: 0,
    };

    mockStore = jasmine.createSpyObj<TasksStore>(
      'TasksStore',
      ['loadDetail', 'publishTask', 'closeTask'],
      {
        selected: signal(detail),
        loadingDetail: signal(false),
        error: signal(null),
        saving: signal(false),
      },
    );

    mockStore.loadDetail.and.returnValue(Promise.resolve(detail));

    await TestBed.configureTestingModule({
      imports: [TaskDetailComponent],
      providers: [provideRouter([]), { provide: TasksStore, useValue: mockStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskDetailComponent);
    component = fixture.componentInstance;
    component['editId'] = 't-1';
    fixture.detectChanges();
  });

  it('se crea y renderiza detail', () => {
    expect(component).toBeTruthy();
    const title = fixture.nativeElement.querySelector('h1');
    expect(title.textContent).toContain('Tarea 1');
  });

  it('canEdit true en Draft', () => {
    expect(component.canEdit()).toBeTrue();
  });

  it('canPublish true en Draft', () => {
    expect(component.canPublish()).toBeTrue();
  });

  it('canClose false en Draft', () => {
    expect(component.canClose()).toBeFalse();
  });

  it('onPublish llama al store', async () => {
    mockStore.publishTask.and.returnValue(Promise.resolve(null));
    await component.onPublish();
    expect(mockStore.publishTask).toHaveBeenCalledWith('t-1');
  });

  it('onClose llama al store', async () => {
    mockStore.closeTask.and.returnValue(Promise.resolve(null));
    await component.onClose();
    expect(mockStore.closeTask).toHaveBeenCalledWith('t-1');
  });

  it('renderiza estado de carga', () => {
    const store = TestBed.inject(TasksStore) as any;
    store.loadingDetail.set(true);
    fixture.detectChanges();
    const spinner = fixture.nativeElement.querySelector('app-spinner');
    expect(spinner).toBeTruthy();
  });
});
