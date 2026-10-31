import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { FileUploadService } from '@core/services/file-upload.service';
import { SubmissionApiService } from './submission-api.service';
import { SubmissionResponseRaw, SubmissionStatus } from '../models';

describe('SubmissionApiService', () => {
  let service: SubmissionApiService;
  let httpSpy: jasmine.SpyObj<HttpClient>;
  let filesSpy: jasmine.SpyObj<FileUploadService>;

  beforeEach(() => {
    httpSpy = jasmine.createSpyObj<HttpClient>('HttpClient', ['get', 'post', 'patch']);
    filesSpy = jasmine.createSpyObj<FileUploadService>('FileUploadService', ['upload']);
    filesSpy.upload.and.returnValue(
      of({
        publicUuid: 'file-1',
        originalName: 'entrega.pdf',
        contentType: 'application/pdf',
        sizeBytes: 7,
        checksumSha256: 'abc',
        url: '',
        createdAt: '2026-01-15T10:00:00.000Z',
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        SubmissionApiService,
        { provide: HttpClient, useValue: httpSpy },
        { provide: FileUploadService, useValue: filesSpy },
      ],
    });
    service = TestBed.inject(SubmissionApiService);
  });

  it('listByAssignment hace GET y mapea a rows', (done) => {
    httpSpy.get.and.returnValue(
      of({
        success: true,
        data: [
          {
            publicUuid: 'sub-1',
            studentPublicUuid: 'st-1',
            studentFullName: 'Juan',
            status: SubmissionStatus.Submitted,
            submittedAt: '2026-01-15T10:00:00.000Z',
            grade: null,
            hasAttachment: false,
          },
        ],
      }),
    );

    service.listByAssignment('a-1').subscribe((rows) => {
      expect(rows).toHaveSize(1);
      expect(rows[0].studentFullName).toBe('Juan');
      done();
    });
  });

  it('create con attachment sube el archivo y luego POSTea JSON', (done) => {
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
        studentPublicUuid: 'st-1',
        textBody: 'texto',
        attachment: file,
      })
      .subscribe((progress) => {
        if (progress.kind === 'Response') {
          expect(progress.value.publicUuid).toBe('sub-1');
          expect(filesSpy.upload).toHaveBeenCalledWith('submissions', file);
          const body = httpSpy.post.calls.mostRecent().args[1] as {
            studentPublicUuid: string;
            textBody: string;
            attachmentPublicUuid: string;
          };
          expect(body.studentPublicUuid).toBe('st-1');
          expect(body.textBody).toBe('texto');
          expect(body.attachmentPublicUuid).toBe('file-1');
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

    service.create('a-1', { studentPublicUuid: 'st-1', textBody: 'solo texto' }).subscribe((p) => {
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
