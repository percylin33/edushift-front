import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API } from '@core/constants';
import { ApiResponse } from '@core/models';
import {
  CreateMaterialRequest,
  Material,
  MaterialResponseRaw,
  MaterialRow,
  MaterialSummaryRaw,
  toMaterial,
  toMaterialRow,
} from '../models';

/**
 * HTTP boundary para {@code lms.materials} (FE-7a.3 / BE-7a.1).
 *
 * <h3>Endpoint coverage</h3>
 * <ul>
 *   <li>{@link #listBySection} → {@code GET    /v1/lms/sections/{uuid}/materials}</li>
 *   <li>{@link #getMaterial}   → {@code GET    /v1/lms/materials/{uuid}}</li>
 *   <li>{@link #upload}        → {@code POST   /v1/lms/sections/{uuid}/materials} (multipart)</li>
 *   <li>{@link #delete}        → {@code DELETE /v1/lms/materials/{uuid}}</li>
 * </ul>
 *
 * <h3>Download</h3>
 * Download no es un HTTP boundary del SPA: el backend responde con
 * un {@code 302} al signed URL de Firebase, así que la page abre
 * {@code window.location.href = API.LMS.MATERIAL_DOWNLOAD(uuid)} o
 * un anchor con {@code target="_blank"}. El SPA no necesita
 * envolver ese fetch.
 */
@Injectable({ providedIn: 'root' })
export class MaterialApiService {
  private readonly http = inject(HttpClient);

  /* ------------------------------------------------------------------------ */
  /* Listings                                                                 */
  /* ------------------------------------------------------------------------ */

  listBySection(sectionPublicUuid: string): Observable<MaterialRow[]> {
    return this.http
      .get<MaterialSummaryRaw[]>(API.LMS.SECTION_MATERIALS_LIST(sectionPublicUuid))
      .pipe(map((rows) => rows.map(toMaterialRow)));
  }

  getMaterial(publicUuid: string): Observable<Material> {
    return this.http
      .get<ApiResponse<MaterialResponseRaw>>(API.LMS.MATERIAL_BY_UUID(publicUuid))
      .pipe(map((envelope) => toMaterial(envelope.data)));
  }

  /* ------------------------------------------------------------------------ */
  /* Upload (multipart, with progress)                                       */
  /* ------------------------------------------------------------------------ */

  /**
   * Sube un material. Si {@code request.type === LINK} se envía como
   * JSON con sólo `title`, `type` y `url`. En cualquier otro caso
   * multipart con `title`, `type` y part `file` (binario).
   *
   * Devuelve un {@code UploadProgress<Material>} que emite eventos
   * `Sent` / `Progress` durante la subida y `Response` al terminar.
   */
  upload(
    sectionPublicUuid: string,
    request: CreateMaterialRequest,
  ): Observable<MaterialUploadProgress> {
    if (request.type === 'LINK' || !request.file) {
      const json = {
        title: request.title,
        type: request.type,
        url: request.url ?? null,
      };
      return this.toUploadProgress(
        this.http.post<ApiResponse<MaterialResponseRaw>>(
          API.LMS.SECTION_MATERIALS(sectionPublicUuid),
          json,
          { reportProgress: true, observe: 'events' },
        ),
      );
    }

    const fd = new FormData();
    fd.append('title', request.title);
    fd.append('type', request.type);
    fd.append('file', request.file, request.file.name);

    return this.toUploadProgress(
      this.http.post<ApiResponse<MaterialResponseRaw>>(
        API.LMS.SECTION_MATERIALS(sectionPublicUuid),
        fd,
        { reportProgress: true, observe: 'events' },
      ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Delete                                                                   */
  /* ------------------------------------------------------------------------ */

  /**
   * Soft-delete + borra binario en Firebase. Idempotente en backend:
   * devolver el resource ya borrado responde 200 con `null` body o
   * 404 — la page trata ambos como "ok, fuera de la lista".
   */
  delete(publicUuid: string): Observable<void> {
    return this.http.delete<void>(API.LMS.MATERIAL_BY_UUID(publicUuid)).pipe(map(() => void 0));
  }

  /* ------------------------------------------------------------------------ */
  /* Internals                                                                */
  /* ------------------------------------------------------------------------ */

  private toUploadProgress(
    source: Observable<HttpEvent<ApiResponse<MaterialResponseRaw>>>,
  ): Observable<MaterialUploadProgress> {
    return new Observable<MaterialUploadProgress>((sub) => {
      source.subscribe({
        next: (event: HttpEvent<ApiResponse<MaterialResponseRaw>>) => {
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
          if (event.type === HttpEventType.Response) {
            const resp = event as HttpResponse<ApiResponse<MaterialResponseRaw>>;
            if (resp.body) {
              sub.next({ kind: 'Response', value: toMaterial(resp.body.data) });
              sub.complete();
            }
          }
        },
        error: (err: unknown) => sub.error(err),
        complete: () => sub.complete(),
      });
    });
  }
}

export type MaterialUploadProgress =
  | { kind: 'Sent' }
  | { kind: 'Progress'; percent: number | null; loaded: number; total: number }
  | { kind: 'Response'; value: Material };
