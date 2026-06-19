import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MaterialsStore } from './materials.store';
import { MaterialApiService } from '../services';
import { MaterialType, MaterialRow, Material } from '../models';

/**
 * Spec de {@link MaterialsStore} (FE-7a.3).
 *
 * Cubre:
 * <ol>
 *   <li>loadBySection carga y cachea.</li>
 *   <li>upload() agrega el material al listing (mirroring).</li>
 *   <li>remove() lo quita del listing (soft-delete local feedback).</li>
 *   <li>Signals de upload (uploading, uploadPercent) se actualizan.</li>
 * </ol>
 */
describe('MaterialsStore', () => {
  let store: MaterialsStore;
  let mockApi: jasmine.SpyObj<MaterialApiService>;

  function rowOf(overrides: Partial<MaterialRow> = {}): MaterialRow {
    return {
      publicUuid: 'mat-1',
      title: 'Tema 1',
      type: MaterialType.Pdf,
      filename: 'tema1.pdf',
      sizeBytes: 1024,
      contentType: 'application/pdf',
      url: null,
      uploadedByTeacherName: 'Profe Pérez',
      sizeBytesDisplay: '1.0 KB',
      createdAt: new Date('2026-06-01T00:00:00Z'),
      ...overrides
    };
  }

  function materialOf(overrides: Partial<Material> = {}): Material {
    return {
      publicUuid: 'mat-1',
      sectionPublicUuid: 's-1',
      title: 'Tema 1',
      type: MaterialType.Pdf,
      filename: 'tema1.pdf',
      sizeBytes: 1024,
      contentType: 'application/pdf',
      url: null,
      uploadedByTeacherPublicUuid: 'tch-1',
      uploadedByTeacherName: 'Profe Pérez',
      downloadUrl: null,
      createdAt: new Date('2026-06-01T00:00:00Z'),
      updatedAt: null,
      ...overrides
    };
  }

  beforeEach(() => {
    mockApi = jasmine.createSpyObj<MaterialApiService>('MaterialApiService', [
      'listBySection',
      'getMaterial',
      'upload',
      'delete'
    ]);

    mockApi.listBySection.and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        MaterialsStore,
        { provide: MaterialApiService, useValue: mockApi }
      ]
    });
    store = TestBed.inject(MaterialsStore);
  });

  it('loads the section listing', async () => {
    mockApi.listBySection.and.returnValue(of([rowOf()]));

    await store.loadBySection('s-1');

    expect(mockApi.listBySection).toHaveBeenCalledOnceWith('s-1');
    expect(store.rows().length).toBe(1);
    expect(store.currentSectionUuid()).toBe('s-1');
    expect(store.loading()).toBeFalse();
  });

  it('does not re-fetch when called twice with the same uuid and a non-empty listing', async () => {
    mockApi.listBySection.and.returnValue(of([rowOf()]));

    await store.loadBySection('s-1');
    await store.loadBySection('s-1');

    expect(mockApi.listBySection).toHaveBeenCalledTimes(1);
  });

  it('upload() prepends the new material to the listing', async () => {
    mockApi.listBySection.and.returnValue(of([]));
    mockApi.upload.and.returnValue(of({ kind: 'Response', value: materialOf() }) as any);

    await store.loadBySection('s-1');
    const result = await store.upload('s-1', { title: 'Tema 1', type: MaterialType.Pdf, file: null });

    expect(result?.publicUuid).toBe('mat-1');
    expect(store.rows().length).toBe(1);
    expect(store.rows()[0].publicUuid).toBe('mat-1');
  });

  it('upload() exposes progress via the uploading signal', async () => {
    mockApi.upload.and.returnValue(of(
      { kind: 'Progress', percent: 50, loaded: 50, total: 100 },
      { kind: 'Response', value: materialOf() }
    ) as any);

    const promise = store.upload('s-1', { title: 't', type: MaterialType.Pdf });
    // Mientras la primera microtask corre, uploading debería estar true.
    expect(store.uploading()).toBeTrue();
    await promise;
    expect(store.uploading()).toBeFalse();
    expect(store.uploadPercent()).toBe(0);
  });

  it('remove() filters the row out of the listing on success', async () => {
    mockApi.listBySection.and.returnValue(of([rowOf()]));
    mockApi.delete.and.returnValue(of(void 0));

    await store.loadBySection('s-1');
    const ok = await store.remove('mat-1');

    expect(ok).toBeTrue();
    expect(store.rows().length).toBe(0);
  });

  it('remove() leaves the listing untouched on error and surfaces a message', async () => {
    mockApi.listBySection.and.returnValue(of([rowOf()]));
    mockApi.delete.and.returnValue(throwError(() => new Error('network')));

    await store.loadBySection('s-1');
    const ok = await store.remove('mat-1');

    expect(ok).toBeFalse();
    expect(store.rows().length).toBe(1);
    expect(store.error()).toBeTruthy();
  });
});
