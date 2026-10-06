import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, map, switchMap } from 'rxjs';
import { API } from '@core/constants';
import { ApiResponse } from '@core/models';
import { ApiService } from '@core/services';
import {
  ProvisionSectionAccountsRequest,
  ProvisionSectionAccountsResponse,
} from '../models';

/**
 * CRED-7 — mass provision of portal accounts for a classroom section.
 */
@Injectable({ providedIn: 'root' })
export class SectionProvisionApiService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  provision(
    sectionPublicUuid: string,
    body: ProvisionSectionAccountsRequest = {
      includeGuardians: true,
      overwriteMissingEmailWithSynthetic: true,
    },
  ): Observable<ProvisionSectionAccountsResponse> {
    return this.api
      .post<ApiResponse<ProvisionSectionAccountsResponse>, ProvisionSectionAccountsRequest>(
        API.ACADEMIC.SECTIONS.PROVISION_ACCOUNTS(sectionPublicUuid),
        body,
      )
      .pipe(map((envelope) => envelope.data));
  }

  downloadSheet(jobPublicUuid: string): Observable<Blob> {
    return this.downloadBinary(API.ACADEMIC.SECTIONS.PROVISION_SHEET(jobPublicUuid));
  }

  downloadHandoutZip(jobPublicUuid: string): Observable<Blob> {
    return this.downloadBinary(API.ACADEMIC.SECTIONS.PROVISION_HANDOUT_ZIP(jobPublicUuid));
  }

  /**
   * Blob downloads often receive JSON error bodies still as Blob.
   * Reject those so the UI can show a real error instead of a corrupt file.
   */
  private downloadBinary(url: string): Observable<Blob> {
    return this.http
      .get(url, { responseType: 'blob', observe: 'response' })
      .pipe(switchMap((res) => from(this.ensureBinaryBlob(res))));
  }

  private async ensureBinaryBlob(res: HttpResponse<Blob>): Promise<Blob> {
    const blob = res.body;
    if (!blob || blob.size === 0) {
      throw new HttpErrorResponse({
        status: res.status || 500,
        statusText: 'Empty download',
        url: res.url ?? undefined,
      });
    }
    const type = (blob.type || res.headers.get('Content-Type') || '').toLowerCase();
    const looksJson =
      type.includes('application/json') || type.includes('text/json') || type.includes('text/html');
    if (looksJson) {
      const text = await blob.text();
      let message = 'No se pudo descargar el archivo';
      try {
        const parsed = JSON.parse(text) as {
          message?: string;
          error?: string;
          errors?: Array<{ message?: string }>;
        };
        message =
          parsed.message ||
          parsed.error ||
          parsed.errors?.[0]?.message ||
          message;
      } catch {
        if (text.trim()) message = text.slice(0, 200);
      }
      throw new HttpErrorResponse({
        error: { message },
        status: res.status >= 400 ? res.status : 500,
        statusText: message,
        url: res.url ?? undefined,
      });
    }
    // Empty Content-Type is fine (some proxies strip it); ZIP/XLSX still usable.
    return blob;
  }
}
