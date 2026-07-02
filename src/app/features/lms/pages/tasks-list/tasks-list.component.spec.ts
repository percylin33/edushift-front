import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TasksListComponent } from './tasks-list.component';
import { TasksStore } from '../../store';
import { TaskLifecycle } from '../../models';

describe('TasksListComponent', () => {
  let component: TasksListComponent;
  let fixture: ComponentFixture<TasksListComponent>;
  let mockStore: jasmine.SpyObj<TasksStore>;

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
      providers: [provideRouter([]), { provide: TasksStore, useValue: mockStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(TasksListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('lifecycleLabel retorna label en español', () => {
    expect(component.lifecycleLabel(TaskLifecycle.Draft)).toBe('Borrador');
    expect(component.lifecycleLabel(TaskLifecycle.Published)).toBe('Publicada');
    expect(component.lifecycleLabel(TaskLifecycle.Closed)).toBe('Cerrada');
  });

  it('emptyTitle retorna string para no-student', () => {
    expect(component.emptyTitle()).toBe('Aún no hay tareas');
  });

  it('emptyDescription sin filtro activo', () => {
    expect(component.emptyDescription()).toContain('Crea la primera tarea');
  });

  it('reload llama clearError y loadBySection', () => {
    (component as any).__set('_sectionUuid', 's-1');
    component.reload();
    expect(mockStore.clearError).toHaveBeenCalled();
  });
});
