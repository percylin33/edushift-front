import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpEventType, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { SubmissionApiService, UploadProgress } from './submission-api.service';
import { SubmissionResponseRaw, SubmissionStatus, toSubmission } from '../models';

describe('SubmissionApiService', () => {
  let service: SubmissionApiService;
  let httpSpy: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    httpSpy = jasmine.createSpyObj<HttpClient>('HttpClient', ['get', 'post', 'patch']);
    TestBed.configureTestingModule({
      providers: [SubmissionApiService, { provide: HttpClient, useValue: httpSpy }],
    });
    service = TestBed.inject(SubmissionApiService);
  });

  it('listByAssignment hace GET y mapea a rows', (done) => {
    httpSpy.get.and.returnValue(
      of([
        {
          publicUuid: 'sub-1',
          studentPublicUuid: 'st-1',
          studentFullName: 'Juan',
          studentAvatarUrl: null,
          status: SubmissionStatus.Submitted,
          version: 1,
          submittedAt: '2026-01-15T10:00:00.000Z',
          grade: null,
          hasAttachment: false,
        },
      ]),
    );

    service.listByAssignment('a-1').subscribe((rows) => {
      expect(rows).toHaveSize(1);
      expect(rows[0].studentFullName).toBe('Juan');
      done();
    });
  });

  it('create con attachment usa FormData y reportProgress', (done) => {
    const raw: SubmissionResponseRaw = {
      publicUuid: 'sub-1',
      assignmentPublicUuid: 'a-1',
      studentPublicUuid: 'st-1',
      submittedByUserPublicUuid: 'u-1',
      submittedForStudentPublicUuid: null,
      status: SubmissionStatus.Submitted,
      textContent: 'texto',
      attachment: null,
      version: 1,
      grade: null,
      feedback: null,
      submittedAt: '2026-01-15T10:00:00.000Z',
      gradedAt: null,
      gradedByTeacherPublicUuid: null,
      returnedAt: null,
      returnedByTeacherPublicUuid: null,
    };
    const resp = new HttpResponse({ body: { success: true, data: raw } });
    httpSpy.post.and.returnValue(of(resp));

    const file = new File(['content'], 'entrega.pdf', { type: 'application/pdf' });

    service
      .create('a-1', {
        textContent: 'texto',
        attachment: file,
        submittedForStudentPublicUuid: null,
      })
      .subscribe((progress) => {
        if (progress.kind === 'Response') {
          expect(progress.value.publicUuid).toBe('sub-1');
          done();
        }
      });
  });

  it('create sin attachment envía JSON', (done) => {
    const raw: SubmissionResponseRaw = {
      publicUuid: 'sub-2',
      assignmentPublicUuid: 'a-1',
      studentPublicUuid: 'st-1',
      submittedByUserPublicUuid: 'u-1',
      submittedForStudentPublicUuid: null,
      status: SubmissionStatus.Submitted,
      textContent: 'solo texto',
      attachment: null,
      version: 1,
      grade: null,
      feedback: null,
      submittedAt: '2026-01-15T10:00:00.000Z',
      gradedAt: null,
      gradedByTeacherPublicUuid: null,
      returnedAt: null,
      returnedByTeacherPublicUuid: null,
    };
    const resp = new HttpResponse({ body: { success: true, data: raw } });
    httpSpy.post.and.returnValue(of(resp));

    service.create('a-1', { textContent: 'solo texto' }).subscribe((p) => {
      if (p.kind === 'Response') {
        expect(p.value.textContent).toBe('solo texto');
        done();
      }
    });
  });

  it('grade PATCHea y devuelve Submission', (done) => {
    const raw: SubmissionResponseRaw = {
      publicUuid: 'sub-1',
      assignmentPublicUuid: 'a-1',
      studentPublicUuid: 'st-1',
      submittedByUserPublicUuid: 'u-1',
      submittedForStudentPublicUuid: null,
      status: SubmissionStatus.Graded,
      textContent: null,
      attachment: null,
      version: 1,
      grade: 15,
      feedback: 'Buen trabajo',
      submittedAt: '2026-01-15T10:00:00.000Z',
      gradedAt: '2026-01-16T10:00:00.000Z',
      gradedByTeacherPublicUuid: 'tch-1',
      returnedAt: null,
      returnedByTeacherPublicUuid: null,
    };
    httpSpy.patch.and.returnValue(of({ success: true, data: raw }));

    service.grade('sub-1', { grade: 15, feedback: 'Buen trabajo' }).subscribe((s) => {
      expect(s.grade).toBe(15);
      done();
    });
  });

  it('return PATCHea y devuelve Submission con status Returned', (done) => {
    const raw: SubmissionResponseRaw = {
      publicUuid: 'sub-1',
      assignmentPublicUuid: 'a-1',
      studentPublicUuid: 'st-1',
      submittedByUserPublicUuid: 'u-1',
      submittedForStudentPublicUuid: null,
      status: SubmissionStatus.Returned,
      textContent: null,
      attachment: null,
      version: 1,
      grade: null,
      feedback: 'Corrige esto',
      submittedAt: '2026-01-15T10:00:00.000Z',
      gradedAt: null,
      gradedByTeacherPublicUuid: null,
      returnedAt: '2026-01-16T10:00:00.000Z',
      returnedByTeacherPublicUuid: 'tch-1',
    };
    httpSpy.patch.and.returnValue(of({ success: true, data: raw }));

    service.return('sub-1', { feedback: 'Corrige esto' }).subscribe((s) => {
      expect(s.status).toBe(SubmissionStatus.Returned);
      done();
    });
  });
});
