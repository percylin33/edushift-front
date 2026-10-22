import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ApiEnvelope,
  DisclosureContent,
  DisclosureFieldDefinition,
  DisclosureField,
  DisclosurePackage,
  DisclosurePublication,
  DisclosureVersionSummary,
} from '../models/disclosure.model';

@Injectable({ providedIn: 'root' })
export class DisclosuresApiService {
  private readonly http = inject(HttpClient);
  private readonly adminBase = '/api/v1/disclosures';
  private readonly familyBase = '/api/v1/family/disclosures';

  getCatalog(): Observable<ApiEnvelope<DisclosureFieldDefinition[]>> {
    return this.http.get<ApiEnvelope<DisclosureFieldDefinition[]>>(`${this.adminBase}/catalog`);
  }

  getWorkspace(yearUuid: string): Observable<ApiEnvelope<DisclosurePackage>> {
    return this.http.get<ApiEnvelope<DisclosurePackage>>(`${this.adminBase}/years/${yearUuid}`);
  }

  save(yearUuid: string, content: DisclosureContent): Observable<ApiEnvelope<DisclosurePackage>> {
    return this.http.put<ApiEnvelope<DisclosurePackage>>(`${this.adminBase}/years/${yearUuid}`, { content });
  }

  saveField(yearUuid: string, fieldKey: string, field: DisclosureField,
    attachments: DisclosureContent['attachments']): Observable<ApiEnvelope<DisclosurePackage>> {
    return this.http.put<ApiEnvelope<DisclosurePackage>>(
      `${this.adminBase}/years/${yearUuid}/fields/${encodeURIComponent(fieldKey)}`, { field, attachments },
    );
  }

  copyPreviousYear(yearUuid: string): Observable<ApiEnvelope<DisclosurePackage>> {
    return this.http.post<ApiEnvelope<DisclosurePackage>>(`${this.adminBase}/years/${yearUuid}/copy-previous`, {});
  }

  submitForReview(yearUuid: string): Observable<ApiEnvelope<DisclosurePackage>> {
    return this.http.post<ApiEnvelope<DisclosurePackage>>(`${this.adminBase}/years/${yearUuid}/submit-review`, {});
  }

  requestChanges(yearUuid: string, note: string): Observable<ApiEnvelope<DisclosurePackage>> {
    return this.http.post<ApiEnvelope<DisclosurePackage>>(
      `${this.adminBase}/years/${yearUuid}/request-changes`, { note },
    );
  }

  approve(yearUuid: string): Observable<ApiEnvelope<DisclosurePackage>> {
    return this.http.post<ApiEnvelope<DisclosurePackage>>(`${this.adminBase}/years/${yearUuid}/approve`, {});
  }

  publish(yearUuid: string): Observable<ApiEnvelope<DisclosurePackage>> {
    return this.http.post<ApiEnvelope<DisclosurePackage>>(`${this.adminBase}/years/${yearUuid}/publish`, {});
  }

  listVersions(yearUuid: string): Observable<ApiEnvelope<DisclosureVersionSummary[]>> {
    return this.http.get<ApiEnvelope<DisclosureVersionSummary[]>>(`${this.adminBase}/years/${yearUuid}/versions`);
  }

  getVersion(yearUuid: string, version: number): Observable<ApiEnvelope<DisclosurePublication>> {
    return this.http.get<ApiEnvelope<DisclosurePublication>>(`${this.adminBase}/years/${yearUuid}/versions/${version}`);
  }

  downloadPreview(yearUuid: string): Observable<Blob> {
    return this.http.get(`${this.adminBase}/years/${yearUuid}/preview.pdf`, { responseType: 'blob' });
  }

  listFamilyPublications(): Observable<ApiEnvelope<DisclosurePublication[]>> {
    return this.http.get<ApiEnvelope<DisclosurePublication[]>>(this.familyBase);
  }

  getFamilyCatalog(): Observable<ApiEnvelope<DisclosureFieldDefinition[]>> {
    return this.http.get<ApiEnvelope<DisclosureFieldDefinition[]>>(`${this.familyBase}/catalog`);
  }

  downloadFamilyCopy(yearUuid: string): Observable<Blob> {
    return this.http.get(`${this.familyBase}/${yearUuid}/download`, { responseType: 'blob' });
  }
}
