import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { API } from '@core/constants';

export interface AiPlatformSource {
  publicUuid: string;
  title: string;
  status: 'INDEXING' | 'PROCESSING' | 'READY' | 'PUBLISHED' | 'NEEDS_OCR' | 'FAILED' | 'RETIRED';
  audiences: string[];
  sourceUrl: string;
  sourceVersion: string;
  effectiveAt: string | null;
  reviewAfter: string;
  originalName: string;
  sizeBytes: number;
  textBytes: number;
  indexErrorCode: string | null;
}

export interface AiPlatformSourceReview {
  extractedTextPreview: string;
  indexedChunks: number;
  previewTruncated: boolean;
}

export interface AiPlatformSourceReviewChecks {
  officialUrlMatchesFile: boolean;
  currentVersionConfirmed: boolean;
  extractedTextReviewed: boolean;
  audiencesAndDatesConfirmed: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminAiPlatformSourcesService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  readonly sources = signal<AiPlatformSource[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async load(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(this.api.get<any>(API.ADMIN.AI_GLOBAL_SOURCES));
      this.sources.set(response?.data ?? response ?? []);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'No se pudieron cargar las fuentes globales.');
    } finally {
      this.busy.set(false);
    }
  }

  async upload(fields: {
    title: string;
    sourceUrl: string;
    sourceVersion: string;
    effectiveAt: string;
    reviewAfter: string;
    audiences: string[];
    file: File;
  }): Promise<void> {
    const body = new FormData();
    body.append('title', fields.title.trim());
    body.append('sourceUrl', fields.sourceUrl.trim());
    body.append('sourceVersion', fields.sourceVersion.trim());
    if (fields.effectiveAt) body.append('effectiveAt', fields.effectiveAt);
    body.append('reviewAfter', fields.reviewAfter);
    for (const audience of fields.audiences) body.append('audiences', audience);
    body.append('file', fields.file, fields.file.name);
    await firstValueFrom(this.api.post(API.ADMIN.AI_GLOBAL_SOURCES, body));
    await this.load();
  }

  async loadReview(uuid: string): Promise<AiPlatformSourceReview> {
    const response = await firstValueFrom(
      this.api.get<{ data: AiPlatformSourceReview }>(API.ADMIN.AI_GLOBAL_SOURCE_REVIEW(uuid)),
    );
    return response.data;
  }

  downloadOriginal(uuid: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(API.ADMIN.AI_GLOBAL_SOURCE_FILE(uuid), { responseType: 'blob' }),
    );
  }

  async publish(uuid: string, review: AiPlatformSourceReviewChecks): Promise<void> {
    await firstValueFrom(this.api.post(API.ADMIN.AI_GLOBAL_SOURCE_PUBLISH(uuid), review));
    await this.load();
  }

  async retry(uuid: string): Promise<void> {
    await firstValueFrom(this.api.post(API.ADMIN.AI_GLOBAL_SOURCE_RETRY(uuid), {}));
    await this.load();
  }

  async reindex(uuid: string): Promise<void> {
    await firstValueFrom(this.api.post(API.ADMIN.AI_GLOBAL_SOURCE_REINDEX(uuid), {}));
    await this.load();
  }

  async retire(uuid: string): Promise<void> {
    await firstValueFrom(this.api.delete(API.ADMIN.AI_GLOBAL_SOURCE_RETIRE(uuid)));
    await this.load();
  }
}
