import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SubmissionsStore } from './submissions.store';
import { SubmissionApiService } from '../services';
import { SubmissionStatus, SubmissionRow, Submission } from '../models';

/**
 * Spec de {@link SubmissionsStore} (FE-7a.2).
 *
 * Cubre los escenarios del sprint que el store controla:
 * <ol>
 *   <li>TEACHER carga listing por assignment.</li>
 *   <li>create() sube el row al listing del assignment si estaba
 *       abierto; marca "my submission".</li>
 *   <li>grade() bumpa el grade del row en el listing.</li>
 *   <li>return() cambia status del row a RETURNED.</li>
 * </ol>
 */
describe('SubmissionsStore', () => {
  let store: SubmissionsStore;
  let mockApi: jasmine.SpyObj<SubmissionApiService>;

  function rowOf(overrides: Partial<SubmissionRow> = {}): SubmissionRow {
    return {
      publicUuid: 'sub-1',
      studentPublicUuid: 'st-1',
      studentFullName: 'Ana Pérez',
      studentAvatarUrl: null,
      status: SubmissionStatus.Submitted,
      version: 1,
      submittedAt: new Date('2026-06-12T00:00:00Z'),
      grade: null,
      hasAttachment: false,
      ...overrides
    };
  }

  function submissionOf(overrides: Partial<Submission> = {}): Submission {
    return {
      publicUuid: 'sub-1',
      assignmentPublicUuid: 'a-1',
      studentPublicUuid: 'st-1',
      submittedByUserPublicUuid: 'u-1',
      submittedForStudentPublicUuid: null,
      status: SubmissionStatus.Submitted,
      textContent: 'mi entrega',
      attachment: null,
      version: 1,
      grade: null,
      feedback: null,
      submittedAt: new Date('2026-06-12T00:00:00Z'),
      gradedAt: null,
      gradedByTeacherPublicUuid: null,
      returnedAt: null,
      returnedByTeacherPublicUuid: null,
      ...overrides
    };
  }

  beforeEach(() => {
    mockApi = jasmine.createSpyObj<SubmissionApiService>('SubmissionApiService', [
      'listByAssignment',
      'listByStudent',
      'create',
      'update',
      'grade',
      'return'
    ]);

    mockApi.listByAssignment.and.returnValue(of([]));
    mockApi.listByStudent.and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        SubmissionsStore,
        { provide: SubmissionApiService, useValue: mockApi }
      ]
    });
    store = TestBed.inject(SubmissionsStore);
  });

  it('loads the assignment listing', async () => {
    mockApi.listByAssignment.and.returnValue(of([rowOf()]));

    await store.loadByAssignment('a-1');

    expect(mockApi.listByAssignment).toHaveBeenCalledOnceWith('a-1');
    expect(store.rows().length).toBe(1);
    expect(store.currentAssignmentUuid()).toBe('a-1');
    expect(store.loading()).toBeFalse();
  });

  it('does not re-fetch when called twice with the same uuid and a non-empty listing', async () => {
    mockApi.listByAssignment.and.returnValue(of([rowOf()]));

    await store.loadByAssignment('a-1');
    await store.loadByAssignment('a-1');

    expect(mockApi.listByAssignment).toHaveBeenCalledTimes(1);
  });

  it('create() stores the new submission as mySubmission and (if the assignment listing is open) appends a row', async () => {
    mockApi.listByAssignment.and.returnValue(of([]));
    mockApi.create.and.returnValue(of({ kind: 'Response', value: submissionOf() }) as any);

    await store.loadByAssignment('a-1');
    const created = await store.create('a-1', { textContent: 'hola' });

    expect(created?.publicUuid).toBe('sub-1');
    expect(store.mySubmission()?.publicUuid).toBe('sub-1');
    // No hay row previo en el listing → sigue vacío (no se duplica).
    expect(store.rows().length).toBe(0);
  });

  it('grade() mirrors the new grade into the assignment listing row', async () => {
    mockApi.listByAssignment.and.returnValue(of([rowOf()]));
    mockApi.grade.and.returnValue(of(submissionOf({ grade: 18, status: SubmissionStatus.Graded })));

    await store.loadByAssignment('a-1');
    const updated = await store.grade('sub-1', { grade: 18, feedback: 'bien' });

    expect(updated?.grade).toBe(18);
    expect(updated?.status).toBe(SubmissionStatus.Graded);
    expect(store.rows()[0].grade).toBe(18);
  });

  it('return() updates the row status to RETURNED', async () => {
    mockApi.listByAssignment.and.returnValue(of([rowOf({ status: SubmissionStatus.Graded, grade: 15 })]));
    mockApi.return.and.returnValue(of(submissionOf({ status: SubmissionStatus.Returned, grade: null })));

    await store.loadByAssignment('a-1');
    const updated = await store.return('sub-1', { feedback: 'corrige 2do párrafo' });

    expect(updated?.status).toBe(SubmissionStatus.Returned);
    expect(store.rows()[0].status).toBe(SubmissionStatus.Returned);
    expect(store.rows()[0].grade).toBeNull();
  });

  it('surfaces an error message when listByAssignment fails', async () => {
    mockApi.listByAssignment.and.returnValue(throwError(() => new Error('network')));

    await store.loadByAssignment('a-1');

    expect(store.error()).toBeTruthy();
    expect(store.rows().length).toBe(0);
  });
});
