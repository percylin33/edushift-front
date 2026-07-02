import { TestBed } from '@angular/core/testing';
import { of, Observable } from 'rxjs';
import { SubmissionsStore } from './submissions.store';
import { SubmissionApiService, UploadProgress } from '../services';
import { SubmissionRow, SubmissionStatus, Submission } from '../models';

describe('SubmissionsStore', () => {
  let store: SubmissionsStore;
  let mockApi: jasmine.SpyObj<SubmissionApiService>;

  function rowOf(overrides: Partial<SubmissionRow> = {}): SubmissionRow {
    return {
      publicUuid: 'sub-1',
      studentPublicUuid: 'st-1',
      studentFullName: 'Juan',
      studentAvatarUrl: null,
      status: SubmissionStatus.Submitted,
      version: 1,
      submittedAt: new Date('2026-01-15T10:00:00Z'),
      grade: null,
      hasAttachment: false,
      ...overrides,
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
      textContent: null,
      attachment: null,
      version: 1,
      grade: null,
      feedback: null,
      submittedAt: new Date('2026-01-15T10:00:00Z'),
      gradedAt: null,
      gradedByTeacherPublicUuid: null,
      returnedAt: null,
      returnedByTeacherPublicUuid: null,
      ...overrides,
    };
  }

  function uploadStream<T>(final: T): Observable<UploadProgress<T>> {
    return new Observable<UploadProgress<T>>((sub) => {
      sub.next({ kind: 'Sent' });
      sub.next({ kind: 'Progress', percent: 50, loaded: 50, total: 100 });
      sub.next({ kind: 'Response', value: final });
      sub.complete();
    });
  }

  beforeEach(() => {
    mockApi = jasmine.createSpyObj<SubmissionApiService>('SubmissionApiService', [
      'listByAssignment',
      'listByStudent',
      'create',
      'update',
      'grade',
      'return',
    ]);
    mockApi.listByAssignment.and.returnValue(of([]));
    mockApi.listByStudent.and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [SubmissionsStore, { provide: SubmissionApiService, useValue: mockApi }],
    });
    store = TestBed.inject(SubmissionsStore);
  });

  it('loadByAssignment carga rows', async () => {
    mockApi.listByAssignment.and.returnValue(of([rowOf()]));
    await store.loadByAssignment('a-1');
    expect(store.rows()).toHaveSize(1);
    expect(store.currentAssignmentUuid()).toBe('a-1');
  });

  it('loadByAssignment cachea con mismos args', async () => {
    mockApi.listByAssignment.and.returnValue(of([rowOf()]));
    await store.loadByAssignment('a-1');
    await store.loadByAssignment('a-1');
    expect(mockApi.listByAssignment).toHaveBeenCalledTimes(1);
  });

  it('loadByStudent carga studentRows', async () => {
    mockApi.listByStudent.and.returnValue(of([rowOf({ publicUuid: 'sub-2' })]));
    await store.loadByStudent('st-1');
    expect(store.studentRows()).toHaveSize(1);
    expect(store.currentStudentUuid()).toBe('st-1');
  });

  it('create con upload progresivo', async () => {
    const sub = submissionOf();
    mockApi.create.and.returnValue(uploadStream(sub));
    mockApi.listByAssignment.and.returnValue(of([rowOf()]));

    await store.loadByAssignment('a-1');
    const result = await store.create('a-1', { textContent: 'respuesta' });

    expect(result?.publicUuid).toBe('sub-1');
    expect(store.mySubmission()).toBeTruthy();
  });

  it('grade actualiza el row en listing', async () => {
    mockApi.listByAssignment.and.returnValue(of([rowOf()]));
    mockApi.grade.and.returnValue(of(submissionOf({ status: SubmissionStatus.Graded, grade: 15 })));

    await store.loadByAssignment('a-1');
    const result = await store.grade('sub-1', { grade: 15 });
    expect(result?.grade).toBe(15);
    expect(store.rows()[0].grade).toBe(15);
  });

  it('return actualiza el row en listing', async () => {
    mockApi.listByAssignment.and.returnValue(
      of([rowOf({ status: SubmissionStatus.Graded, grade: 10 })]),
    );
    mockApi.return.and.returnValue(
      of(submissionOf({ status: SubmissionStatus.Returned, grade: null })),
    );

    await store.loadByAssignment('a-1');
    const result = await store.return('sub-1', { feedback: 'revisa' });
    expect(result?.status).toBe(SubmissionStatus.Returned);
    expect(store.rows()[0].status).toBe(SubmissionStatus.Returned);
  });

  it('clearError resetea error signal', () => {
    store['_error'].set('error');
    store.clearError();
    expect(store.error()).toBeNull();
  });

  it('setMySubmission actualiza mySubmission', () => {
    const sub = submissionOf();
    store.setMySubmission(sub);
    expect(store.mySubmission()).toEqual(sub);
  });

  it('hasMySubmission computed funciona', () => {
    expect(store.hasMySubmission()).toBeFalse();
    store.setMySubmission(submissionOf());
    expect(store.hasMySubmission()).toBeTrue();
  });
});
