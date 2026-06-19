import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API } from '@core/constants';
import { ApiResponse } from '@core/models';
import {
  CreateSubmissionRequest,
  GradeSubmissionRequest,
  ReturnSubmissionRequest,
  Submission,
  SubmissionRow,
  SubmissionResponseRaw,
  SubmissionSummaryRaw,
  UpdateSubmissionRequest,
  toSubmission,
  toSubmissionRow
} from '../models';

/**
 * HTTP boundary para {@code lms.submissions} (FE-7a.2 / BE-7a.2).
 *
 * <h3>Endpoint coverage</h3>
 * <ul>
 *   <li>{@link #listByAssignment}   → {@code GET    /v1/lms/assignments/{uuid}/submissions} (TEACHER)</li>
 *   <li>{@link #listByStudent}      → {@code GET    /v1/lms/students/{uuid}/submissions} (STUDENT/PARENT)</li>
 *   <li>{@link #create}             → {@code POST   /v1/lms/assignments/{uuid}/submissions} (multipart)</li>
 *   <li>{@link #update}             → {@code PATCH  /v1/lms/submissions/{uuid}} (multipart)</li>
 *   <li>{@link #grade}              → {@code PATCH  /v1/lms/submissions/{uuid}/grade} (JSON)</li>
 *   <li>{@link #return}             → {@code PATCH  /v1/lms/submissions/{uuid}/return} (JSON)</li>
 * </ul>
 *
 * <h3>Upload progress</h3>
 * {@link #create} y {@link #update} exponen un {@code Observable<UploadProgress<T>>}
 * que emite eventos `Sent` durante la subida y, finalmente, `Response`
 * con la submission materializada. La page usa esto para alimentar
 * la progress bar (`aria-live="polite"`).
 */
@Injectable({ providedIn: 'root' })
export class SubmissionApiService {
  private readonly http = inject(HttpClient);

  /* ------------------------------------------------------------------------ */
  /* Listings                                                                 */
  /* ------------------------------------------------------------------------ */

  listByAssignment(assignmentPublicUuid: string): Observable<SubmissionRow[]> {
    return this.http
      .get<SubmissionSummaryRaw[]>(
        API.LMS.ASSIGNMENT_SUBMISSIONS_LIST(assignmentPublicUuid)
      )
      .pipe(map((rows) => rows.map(toSubmissionRow)));
  }

  listByStudent(studentPublicUuid: string): Observable<SubmissionRow[]> {
    return this.http
      .get<SubmissionSummaryRaw[]>(
        API.LMS.SUBMISSIONS_BY_STUDENT(studentPublicUuid)
      )
      .pipe(map((rows) => rows.map(toSubmissionRow)));
  }

  /* ------------------------------------------------------------------------ */
  /* Create / Update — multipart upload                                       */
  /* ------------------------------------------------------------------------ */

  /**
   * Crea una submission. Si se pasa `attachment`, se serializa como
   * `multipart/form-data` con el part "attachment". Si no, se envía
   * como `application/json` con sólo `textContent` (y opcionalmente
   * `submittedForStudentPublicUuid`).
   */
  create(
    assignmentPublicUuid: string,
    body: CreateSubmissionRequest
  ): Observable<UploadProgress<Submission>> {
    if (body.attachment) {
      const fd = new FormData();
      fd.append('attachment', body.attachment, body.attachment.name);
      if (body.textContent) fd.append('textContent', body.textContent);
      if (body.submittedForStudentPublicUuid) {
        fd.append('submittedForStudentPublicUuid', body.submittedForStudentPublicUuid);
      }
      return this.toUploadProgress(
        this.http.post<ApiResponse<SubmissionResponseRaw>>(
          API.LMS.ASSIGNMENT_SUBMISSIONS(assignmentPublicUuid),
          fd,
          { reportProgress: true, observe: 'events' }
        )
      );
    }

    const json = {
      textContent: body.textContent ?? null,
      submittedForStudentPublicUuid: body.submittedForStudentPublicUuid ?? null
    };
    return this.toUploadProgress(
      this.http.post<ApiResponse<SubmissionResponseRaw>>(
        API.LMS.ASSIGNMENT_SUBMISSIONS(assignmentPublicUuid),
        json,
        { reportProgress: true, observe: 'events' }
      )
    );
  }

  update(
    submissionPublicUuid: string,
    body: UpdateSubmissionRequest
  ): Observable<UploadProgress<Submission>> {
    if (body.attachment) {
      const fd = new FormData();
      fd.append('attachment', body.attachment, body.attachment.name);
      if (body.textContent !== undefined) fd.append('textContent', body.textContent ?? '');
      return this.toUploadProgress(
        this.http.patch<ApiResponse<SubmissionResponseRaw>>(
          API.LMS.SUBMISSION_PATCH(submissionPublicUuid),
          fd,
          { reportProgress: true, observe: 'events' }
        )
      );
    }

    const json = { textContent: body.textContent ?? null };
    return this.toUploadProgress(
      this.http.patch<ApiResponse<SubmissionResponseRaw>>(
        API.LMS.SUBMISSION_PATCH(submissionPublicUuid),
        json,
        { reportProgress: true, observe: 'events' }
      )
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Lifecycle transitions                                                   */
  /* ------------------------------------------------------------------------ */

  grade(
    submissionPublicUuid: string,
    body: GradeSubmissionRequest
  ): Observable<Submission> {
    return this.http
      .patch<ApiResponse<SubmissionResponseRaw>>(
        API.LMS.SUBMISSION_GRADE(submissionPublicUuid),
        body
      )
      .pipe(map((envelope) => toSubmission(envelope.data)));
  }

  return(
    submissionPublicUuid: string,
    body: ReturnSubmissionRequest = {}
  ): Observable<Submission> {
    return this.http
      .patch<ApiResponse<SubmissionResponseRaw>>(
        API.LMS.SUBMISSION_RETURN(submissionPublicUuid),
        body
      )
      .pipe(map((envelope) => toSubmission(envelope.data)));
  }

  /* ------------------------------------------------------------------------ */
  /* Internals                                                                */
  /* ------------------------------------------------------------------------ */

  /**
   * Reduce the stream of {@code HttpEvent}s to a domain-friendly
   * `UploadProgress<T>`. The downstream component switches on
   * `event.type` to update its progress bar; the final `Response`
   * carries the parsed submission.
   */
  private toUploadProgress(
    source: Observable<HttpEvent<ApiResponse<SubmissionResponseRaw>>>
  ): Observable<UploadProgress<Submission>> {
    return new Observable<UploadProgress<Submission>>((sub) => {
      source.subscribe({
        next: (event) => {
          if (event.type === HttpEventType.Sent) {
            sub.next({ kind: 'Sent' });
            return;
          }
          if (event.type === HttpEventType.UploadProgress) {
            const total = event.total ?? 0;
            const loaded = event.loaded;
            const percent = total > 0 ? Math.round((loaded / total) * 100) : null;
            sub.next({ kind: 'Progress', percent, loaded, total });
            return;
          }
          if (event.type === HttpEventType.Response && event.body) {
            sub.next({ kind: 'Response', value: toSubmission(event.body.data) });
            sub.complete();
          }
        },
        error: (err) => sub.error(err),
        complete: () => sub.complete()
      });
    });
  }
}

/**
 * Discriminated union emitted by the multipart upload streams.
 * The page uses `kind` to switch between "show progress bar" and
 * "show success / error toast".
 */
export type UploadProgress<T> =
  | { kind: 'Sent' }
  | { kind: 'Progress'; percent: number | null; loaded: number; total: number }
  | { kind: 'Response'; value: T };
