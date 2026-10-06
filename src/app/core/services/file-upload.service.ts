import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom, from, throwError, defer } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

import { API } from '@core/constants';
import { environment } from '../../../environments/environment';

/** Result of {@link FileUploadService.requestUpload}. */
export interface UploadTicket {
  provider: 'FIREBASE' | 'LOCAL_FS';
  publicUuid: string;
  uploadUrl: string | null;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
}

/** Metadata about a successfully uploaded file. */
export interface FileMetadata {
  publicUuid: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  url: string;
  createdAt: string;
}

/**
 * Signed-URL file upload orchestrator (V50, docs/infra/firebase.md).
 *
 * <p>End-to-end flow:</p>
 * <ol>
 *   <li>Call {@link requestUpload} → BE mints a signed PUT URL and
 *       persists a {@code lms_file_objects} row in {@code PENDING}.</li>
 *   <li>Call {@link uploadBytes} → PUT the bytes to Firebase using the
 *       signed URL (no bearer token needed for the PUT itself).</li>
 *   <li>Call {@link confirmUpload} → BE flips the row to {@code READY}
 *       and persists the SHA-256 the client computed.</li>
 * </ol>
 *
 * <p>For LOCAL_FS the {@code uploadUrl} comes back {@code null}; callers
 * should fall back to {@link uploadMultipart} (BE-proxied multipart).</p>
 */
@Injectable({ providedIn: 'root' })
export class FileUploadService {
  private readonly http = inject(HttpClient);

  private readonly base = () => {
    const base = environment.apiUrl.replace(/\/+$/, '');
    const v = environment.apiVersion ? `/${environment.apiVersion}` : '';
    return `${base}${v}/files`;
  };

  /** Step 1 — ask the BE for a signed PUT URL. */
  requestUpload(module: string, file: File): Observable<UploadTicket> {
    const body = {
      module,
      originalName: file.name,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    };
    return this.http
      .post<{ data: UploadTicket }>(`${this.base()}/upload-requests`, body)
      .pipe(map((r) => r.data));
  }

  /**
   * Step 2 — PUT the bytes to Firebase using the signed URL.
   * Throws when the signed URL is missing (LOCAL_FS path).
   */
  uploadBytes(ticket: UploadTicket, file: File): Observable<void> {
    if (!ticket.uploadUrl) {
      return throwError(() => new Error('uploadUrl is null — use uploadMultipart() for LOCAL_FS.'));
    }
    return defer(() =>
      from(
        fetch(ticket.uploadUrl!, {
          method: 'PUT',
          headers: ticket.requiredHeaders,
          body: file,
        }).then(async (res) => {
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`Firebase PUT failed: ${res.status} ${text}`);
          }
        }),
      ),
    );
  }

  /** Step 3 — tell the BE the PUT succeeded (flips row PENDING → READY). */
  confirmUpload(publicUuid: string, file: File): Observable<FileMetadata> {
    return this.computeSha256(file).pipe(
      switchMap((sha256) =>
        this.http
          .post<{ data: FileMetadata }>(`${this.base()}/${publicUuid}/confirm`, {
            sizeBytes: file.size,
            checksumSha256: sha256,
          })
          .pipe(map((r) => r.data)),
      ),
    );
  }

  /**
   * Fallback for LOCAL_FS or when the FE doesn't want to deal with
   * the signed-URL round-trip — multipart upload proxied by the BE.
   */
  uploadMultipart(module: string, file: File): Observable<FileMetadata> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.http
      .post<{ data: FileMetadata }>(`${this.base()}?module=${encodeURIComponent(module)}`, fd)
      .pipe(map((r) => r.data));
  }

  /**
   * High-level convenience: choose the right path per provider.
   * On FIREBASE: try signed-URL PUT first; on failure (typical cause:
   * missing GCS bucket CORS for the SPA origin) fall back to BE-proxied
   * multipart so uploads still work in local dev.
   */
  upload(module: string, file: File): Observable<FileMetadata> {
    return this.requestUpload(module, file).pipe(
      switchMap((ticket) => {
        if (ticket.provider === 'FIREBASE' && ticket.uploadUrl) {
          return this.uploadBytes(ticket, file).pipe(
            switchMap(() => this.confirmUpload(ticket.publicUuid, file)),
            catchError(() => this.uploadMultipart(module, file)),
          );
        }
        return this.uploadMultipart(module, file);
      }),
    );
  }

  /**
   * Authenticated download — uses HttpClient so the auth interceptor
   * attaches the bearer token. Plain {@code <a href>} links fail with
   * 401 on {@code GET /files/{uuid}/download}.
   */
  download(publicUuid: string): Observable<Blob> {
    return this.http.get(API.FILES.DOWNLOAD(publicUuid), { responseType: 'blob' });
  }

  /** Fetch bytes and trigger a browser save-as dialog. */
  async downloadAndSave(publicUuid: string, filename: string): Promise<void> {
    const blob = await firstValueFrom(this.download(publicUuid));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'adjunto';
    link.rel = 'noopener';
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Compute SHA-256 of a File in the browser. Returns lowercase hex. */
  private computeSha256(file: File): Observable<string> {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      return throwError(() => new Error('Web Crypto API unavailable — cannot compute SHA-256.'));
    }
    return from(
      file.arrayBuffer().then(async (buf) => {
        const digest = await crypto.subtle.digest('SHA-256', buf);
        const bytes = new Uint8Array(digest);
        let out = '';
        for (let i = 0; i < bytes.length; i++) {
          out += bytes[i].toString(16).padStart(2, '0');
        }
        return out;
      }),
    );
  }
}
