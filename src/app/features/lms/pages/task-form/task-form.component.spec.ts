import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TaskFormComponent } from './task-form.component';
import { TasksStore } from '../../store';

describe('TaskFormComponent', () => {
  let component: TaskFormComponent;
  let fixture: ComponentFixture<TaskFormComponent>;
  let mockStore: jasmine.SpyObj<TasksStore>;

  beforeEach(async () => {
    mockStore = jasmine.createSpyObj<TasksStore>(
      'TasksStore',
      ['loadDetail', 'createTask', 'updateTask', 'clearError'],
      {
        loadingDetail: signal(false),
        saving: signal(false),
        error: signal(null),
      },
    );

    mockStore.loadDetail.and.returnValue(Promise.resolve(null));
    mockStore.createTask.and.returnValue(
      Promise.resolve({
        publicUuid: 't-new',
        sectionPublicUuid: 's-1',
        coursePublicUuid: 'c-1',
        periodPublicUuid: 'p-1',
        title: 'Nueva',
        description: null,
        dueAt: null,
        maxScore: 20,
        allowResubmissions: true,
        requiresAttachment: false,
        lifecycle: 'DRAFT' as any,
        createdByTeacherPublicUuid: 'tch-1',
        createdAt: new Date(),
        updatedAt: null,
        submissionsCount: 0,
      }),
    );

    await TestBed.configureTestingModule({
      imports: [TaskFormComponent],
      providers: [provideRouter([]), { provide: TasksStore, useValue: mockStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea en modo creación', () => {
    expect(component).toBeTruthy();
    expect(component.title()).toBe('Nueva tarea');
    expect(component.submitLabel()).toBe('Crear tarea');
  });

  it('submitLabel cambia en modo edición', () => {
    component.editing.set(true);
    expect(component.submitLabel()).toBe('Guardar cambios');
  });

  it('form inválido sin título', () => {
    expect(component.form.get('title')!.valid).toBeFalse();
  });

  it('form válido con datos correctos', () => {
    component.form.patchValue({
      title: 'Tarea válida',
      dueAt: '2030-06-01T12:00',
      maxScore: 20,
      allowResubmissions: true,
      requiresAttachment: false,
    });
    expect(component.form.valid).toBeTrue();
  });

  it('toIsoUtc convierte datetime-local a ISO', () => {
    const iso = component['toIsoUtc']('2030-06-01T12:00');
    expect(iso).toContain('2030-06-01');
  });

  it('toDateTimeLocal convierte Date a string', () => {
    const d = new Date('2030-06-01T12:00:00');
    const local = component['toDateTimeLocal'](d);
    expect(local).toContain('2030-06-01');
  });

  it('showError retorna mensajes según validator', () => {
    const ctrl = component.form.get('title');
    ctrl?.markAsTouched();
    ctrl?.setErrors({ required: true });
    expect(component.showError('title')).toBe('Campo requerido.');
  });

  it('onSubmit no avanza si form inválido', () => {
    spyOn(component.form, 'markAllAsTouched');
    component.onSubmit();
    expect(component.form.markAllAsTouched).toHaveBeenCalled();
  });

  it('onSubmit llama createTask en modo creación', async () => {
    component.form.patchValue({
      title: 'Nueva T',
      dueAt: '2030-06-01T12:00',
      maxScore: 20,
    });
    component['#sectionUuid'] = 's-1';
    await component.onSubmit();
    expect(mockStore.createTask).toHaveBeenCalled();
  });
});
