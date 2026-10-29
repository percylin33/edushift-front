import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { TasksListComponent } from './tasks-list.component';
import { TasksStore } from '../../store';
import { TaskLifecycle } from '../../models';

describe('TasksListComponent', () => {
  let component: TasksListComponent;
  let fixture: ComponentFixture<TasksListComponent>;
  let mockStore: jasmine.SpyObj<TasksStore>;
  const testApi = () =>
    component as unknown as {
      lifecycleLabel(lifecycle: TaskLifecycle): string;
      emptyTitle(): string;
      emptyDescription(): string;
      reload(): void;
    };

  beforeEach(async () => {
    mockStore = jasmine.createSpyObj<TasksStore>(
      'TasksStore',
      ['loadBySection', 'setLifecycleFilter', 'clearError'],
      {
        rows: signal([]),
        loading: signal(false),
        error: signal(null),
        currentSectionUuid: signal(null),
      },
    );

    await TestBed.configureTestingModule({
      imports: [TasksListComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (key: string) => (key === 'sectionUuid' ? 's-1' : null) },
              queryParamMap: { get: () => null },
            },
          },
        },
        { provide: TasksStore, useValue: mockStore },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    spyOnProperty(router, 'url', 'get').and.returnValue('/lms/sections/s-1/assignments');
    fixture = TestBed.createComponent(TasksListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('lifecycleLabel retorna label en español', () => {
    expect(testApi().lifecycleLabel(TaskLifecycle.Draft)).toBe('Borrador');
    expect(testApi().lifecycleLabel(TaskLifecycle.Published)).toBe('Publicada');
    expect(testApi().lifecycleLabel(TaskLifecycle.Closed)).toBe('Cerrada');
  });

  it('emptyTitle retorna string para no-student', () => {
    expect(testApi().emptyTitle()).toBe('Aún no hay tareas');
  });

  it('emptyDescription sin filtro activo', () => {
    expect(testApi().emptyDescription()).toContain('Crea la primera tarea');
  });

  it('reload llama clearError y loadBySection', () => {
    testApi().reload();
    expect(mockStore.clearError).toHaveBeenCalled();
    expect(mockStore.loadBySection).toHaveBeenCalledWith('s-1', {
      lifecycle: undefined,
      assignmentPublicUuid: undefined,
    });
  });
});
