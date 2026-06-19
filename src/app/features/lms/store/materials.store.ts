import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { MaterialApiService, MaterialUploadProgress } from '../services';
import {
  CreateMaterialRequest,
  Material,
  MaterialRow
} from '../models';

/**
 * Reactive store del feature {@code lms.materials} (FE-7a.3).
 *
 * <h3>Slices</h3>
 * <ol>
 *   <li><b>By-section list</b> — la grilla de materiales de la
 *       sección actualmente abierta. Carga perezosa con cache.</li>
 *   <li><b>Selected</b> — el material abierto en detail (no usado
 *       en MVP — la card no navega a detail, dispara download — pero
 *       el slice queda para Fase 8 si se quiere preview in-browser).</li>
 *   <li><b>Upload progress</b> — signals {@code uploading} y
 *       {@code uploadPercent} para alimentar la progress bar del
 *       dialog de upload.</li>
 * </ol>
 *
 * <p>Las mutaciones (upload, delete) refrescan el slice de listing
 * para que el usuario vea el cambio sin tener que recargar.</p>
 */
@Injectable({ providedIn: 'root' })
export class MaterialsStore {
  private readonly api = inject(MaterialApiService);

  // ---------- by-section slice ----------
  private readonly _rows = signal<MaterialRow[]>([]);
  private readonly _currentSectionUuid = signal<string | null>(null);
  private readonly _loading = signal<boolean>(false);

  // ---------- selected slice (Fase 8) ----------
  private readonly _selected = signal<Material | null>(null);
  private readonly _loadingDetail = signal<boolean>(false);

  // ---------- upload progress ----------
  private readonly _uploading = signal<boolean>(false);
  private readonly _uploadPercent = signal<number>(0);

  // ---------- shared ----------
  private readonly _error = signal<string | null>(null);

  // ---------- public read-only API ----------
  readonly rows = this._rows.asReadonly();
  readonly currentSectionUuid = this._currentSectionUuid.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly selected = this._selected.asReadonly();
  readonly loadingDetail = this._loadingDetail.asReadonly();

  readonly uploading = this._uploading.asReadonly();
  readonly uploadPercent = this._uploadPercent.asReadonly();

  readonly error = this._error.asReadonly();

  readonly isEmpty = computed(
    () => !this._loading() && this._rows().length === 0
  );

  // ===========================================================================
  // List by section
  // ===========================================================================

  async loadBySection(sectionUuid: string): Promise<void> {
    if (
      this._currentSectionUuid() === sectionUuid &&
      this._rows().length > 0
    ) {
      return;
    }
    this._currentSectionUuid.set(sectionUuid);
    this._loading.set(true);
    this._error.set(null);
    try {
      const rows = await firstValueFrom(this.api.listBySection(sectionUuid));
      this._rows.set(rows);
    } catch {
      this._rows.set([]);
      this._error.set('No pudimos cargar los materiales de la sección.');
    } finally {
      this._loading.set(false);
    }
  }

  // ===========================================================================
  // Selected
  // ===========================================================================

  async loadDetail(publicUuid: string): Promise<Material | null> {
    this._loadingDetail.set(true);
    this._error.set(null);
    try {
      const detail = await firstValueFrom(this.api.getMaterial(publicUuid));
      this._selected.set(detail);
      return detail;
    } catch {
      this._selected.set(null);
      this._error.set('No pudimos cargar el material. Es posible que haya sido eliminado.');
      return null;
    } finally {
      this._loadingDetail.set(false);
    }
  }

  clearDetail(): void {
    this._selected.set(null);
  }

  // ===========================================================================
  // Upload
  // ===========================================================================

  async upload(
    sectionUuid: string,
    request: CreateMaterialRequest
  ): Promise<Material | null> {
    this._uploading.set(true);
    this._uploadPercent.set(0);
    this._error.set(null);
    try {
      const stream = this.api.upload(sectionUuid, request);
      const final = await drainMaterialUpload(stream, (p) => this._uploadPercent.set(p));
      this._currentSectionUuid.set(sectionUuid);
      this.refreshRowFromMaterial(final);
      return final;
    } catch {
      this._error.set('No pudimos subir el material. Inténtalo de nuevo.');
      return null;
    } finally {
      this._uploading.set(false);
      this._uploadPercent.set(0);
    }
  }

  // ===========================================================================
  // Delete
  // ===========================================================================

  async remove(publicUuid: string): Promise<boolean> {
    this._error.set(null);
    try {
      await firstValueFrom(this.api.delete(publicUuid));
      // Soft-delete: backend lo marca, el listing ya no lo incluye.
      // Filtrado en sitio para feedback inmediato.
      this._rows.update((rows) => rows.filter((r) => r.publicUuid !== publicUuid));
      if (this._selected()?.publicUuid === publicUuid) {
        this._selected.set(null);
      }
      return true;
    } catch {
      this._error.set('No pudimos eliminar el material.');
      return false;
    }
  }

  // ===========================================================================
  // Errors
  // ===========================================================================

  clearError(): void {
    this._error.set(null);
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  /**
   * After upload, mirror the new material into the listing slice.
   * If the listing is for a different section, leave it alone (the
   * user will see the material when they navigate to the right
   * section).
   */
  private refreshRowFromMaterial(material: Material): void {
    if (this._currentSectionUuid() !== material.sectionPublicUuid) return;
    // Convert Material → MaterialRow for the listing. We do the
    // minimum mapping here — the listing slice never has downloadUrl
    // populated (the user clicks "Descargar" which 302's to it).
    const row: MaterialRow = {
      publicUuid: material.publicUuid,
      title: material.title,
      type: material.type,
      filename: material.filename,
      sizeBytes: material.sizeBytes,
      contentType: material.contentType,
      url: material.url,
      uploadedByTeacherName: material.uploadedByTeacherName,
      sizeBytesDisplay: material.sizeBytes != null ? formatSize(material.sizeBytes) : null,
      createdAt: material.createdAt
    };
    this._rows.update((rows) => [row, ...rows]);
  }
}

/**
 * Drains a multipart upload stream to its terminal event, calling
 * {@code onProgress} on each progress tick. Returns the final
 * value once a `Response` event arrives.
 */
function drainMaterialUpload(
  stream: Observable<MaterialUploadProgress>,
  onProgress: (percent: number) => void
): Promise<Material> {
  return firstValueFrom(
    new Observable<Material>((sub) => {
      const inner = stream.subscribe({
        next: (e: MaterialUploadProgress) => {
          if (e.kind === 'Progress' && e.percent !== null) onProgress(e.percent);
          else if (e.kind === 'Response') {
            sub.next(e.value);
            sub.complete();
          }
        },
        error: (err: unknown) => sub.error(err),
        complete: () => sub.complete()
      });
      return () => inner.unsubscribe();
    })
  );
}

/** Bytes → "1.2 MB". */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
