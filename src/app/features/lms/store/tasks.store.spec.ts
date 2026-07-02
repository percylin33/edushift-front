import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TasksStore } from './tasks.store';
import { TaskApiService } from '../services';
import { TaskLifecycle, TaskRow } from '../models';

/**
 * Spec del `TasksStore` (FE-7a.1).
 *
 * <p>Cubre los escenarios de aceptación del sprint que el store
 * controla directamente:
 * <ol>
 *   <li>TEACHER carga el listing por sección.</li>
 *   <li>Filtro por lifecycle re-fetchea y reemplaza en sitio.</li>
 *   <li>Mutaciones (publish, close) reflejan el cambio en el listing
 *       y en el detail simultáneamente.</li>
 *   <li>loadDetail populate el signal selected.</li>
 * </ol>
 */
describe('TasksStore', () => {
  let store: TasksStore;
  let mockApi: jasmine.SpyObj<TaskApiService>;

  function rowOf(overrides: Partial<TaskRow> = {}): TaskRow {
    return {
      publicUuid: 't-1',
      title: 'Tarea 1',
      dueAt: new Date('2030-01-01T00:00:00Z'),
      maxScore: 20,
      lifecycle: TaskLifecycle.Draft,
      submissionsCount: 0,
      sectionLabel: 'Sección A',
      courseLabel: 'Matemáticas',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    };
  }

  function detailOf(
    overrides: Partial<{
      publicUuid: string;
      lifecycle: TaskLifecycle;
      submissionsCount: number;
    }> = {},
  ) {
    return {
      publicUuid: 't-1',
      sectionPublicUuid: 's-1',
      coursePublicUuid: 'c-1',
      periodPublicUuid: 'p-1',
      title: 'Tarea 1',
      description: null,
      dueAt: new Date('2030-01-01T00:00:00Z'),
      maxScore: 20,
      allowResubmissions: true,
      requiresAttachment: false,
      lifecycle: TaskLifecycle.Draft,
      createdByTeacherPublicUuid: 'tch-1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: null,
      submissionsCount: 0,
      ...overrides,
    };
  }

  beforeEach(() => {
    mockApi = jasmine.createSpyObj<TaskApiService>('TaskApiService', [
      'listBySection',
      'listByStudent',
      'getTask',
      'createTask',
      'updateTask',
      'publishTask',
      'closeTask',
    ]);

    // default: empty listing
    mockApi.listBySection.and.returnValue(asObservable([]));
    mockApi.listByStudent.and.returnValue(asObservable([]));

    TestBed.configureTestingModule({
      providers: [TasksStore, { provide: TaskApiService, useValue: mockApi }],
    });
    store = TestBed.inject(TasksStore);
  });

  it('loads the section listing and exposes rows', async () => {
    const rows = [rowOf({ publicUuid: 't-1' }), rowOf({ publicUuid: 't-2' })];
    mockApi.listBySection.and.returnValue(asObservable(rows));

    await store.loadBySection('s-1');

    expect(mockApi.listBySection).toHaveBeenCalledOnceWith('s-1', {});
    expect(store.rows()).toEqual(rows);
    expect(store.currentSectionUuid()).toBe('s-1');
    expect(store.loading()).toBeFalse();
  });

  it('caches the listing when called twice with the same args', async () => {
    mockApi.listBySection.and.returnValue(asObservable([rowOf()]));

    await store.loadBySection('s-1');
    await store.loadBySection('s-1');

    expect(mockApi.listBySection).toHaveBeenCalledTimes(1);
  });

  it('re-fetches when the lifecycle filter changes', async () => {
    mockApi.listBySection.and.returnValue(asObservable([rowOf()]));

    await store.loadBySection('s-1');
    store.setLifecycleFilter(TaskLifecycle.Published);

    // Let the microtask queue drain.
    await Promise.resolve();
    await Promise.resolve();

    expect(mockApi.listBySection).toHaveBeenCalledTimes(2);
    expect(mockApi.listBySection.calls.mostRecent().args[1]).toEqual({
      lifecycle: TaskLifecycle.Published,
    });
  });

  it('publishing a task mirrors the lifecycle into the listing row', async () => {
    mockApi.listBySection.and.returnValue(asObservable([rowOf()]));
    mockApi.publishTask.and.returnValue(
      asObservable(detailOf({ lifecycle: TaskLifecycle.Published, submissionsCount: 2 })),
    );

    await store.loadBySection('s-1');
    const updated = await store.publishTask('t-1');

    expect(updated?.lifecycle).toBe(TaskLifecycle.Published);
    expect(store.rows()[0].lifecycle).toBe(TaskLifecycle.Published);
    expect(store.rows()[0].submissionsCount).toBe(2);
    expect(store.selected()?.lifecycle).toBe(TaskLifecycle.Published);
  });

  it('closing a task mirrors the lifecycle into the listing row', async () => {
    mockApi.listBySection.and.returnValue(
      asObservable([rowOf({ lifecycle: TaskLifecycle.Published })]),
    );
    mockApi.closeTask.and.returnValue(asObservable(detailOf({ lifecycle: TaskLifecycle.Closed })));

    await store.loadBySection('s-1');
    const updated = await store.closeTask('t-1');

    expect(updated?.lifecycle).toBe(TaskLifecycle.Closed);
    expect(store.rows()[0].lifecycle).toBe(TaskLifecycle.Closed);
  });

  it('loadDetail populates the selected signal', async () => {
    mockApi.getTask.and.returnValue(asObservable(detailOf()));

    const detail = await store.loadDetail('t-1');

    expect(detail).toBeTruthy();
    expect(store.selected()?.publicUuid).toBe('t-1');
    expect(store.loadingDetail()).toBeFalse();
  });

  it('loadByStudent populates the student listing', async () => {
    mockApi.listByStudent.and.returnValue(asObservable([rowOf({ publicUuid: 't-9' })]));

    await store.loadByStudent('st-1');

    expect(mockApi.listByStudent).toHaveBeenCalledOnceWith('st-1');
    expect(store.studentRows()[0].publicUuid).toBe('t-9');
    expect(store.currentStudentUuid()).toBe('st-1');
  });
});

/** Tiny helper to convert a plain value into an rxjs Observable. */
import { Observable, of } from 'rxjs';
function asObservable<T>(value: T): Observable<T> {
  return of(value);
}
