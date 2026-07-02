import { TestBed } from '@angular/core/testing';
import { of, Observable } from 'rxjs';
import { MaterialsStore } from './materials.store';
import { MaterialApiService, MaterialUploadProgress } from '../services';
import { Material, MaterialRow, MaterialType } from '../models';

describe('MaterialsStore', () => {
  let store: MaterialsStore;
  let mockApi: jasmine.SpyObj<MaterialApiService>;

  function rowOf(overrides: Partial<MaterialRow> = {}): MaterialRow {
    return {
      publicUuid: 'mat-1',
      title: 'Material',
      type: MaterialType.Pdf,
      filename: 'doc.pdf',
      sizeBytes: 1024,
      contentType: 'application/pdf',
      url: null,
      uploadedByTeacherName: 'Prof.',
      sizeBytesDisplay: '1 KB',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    };
  }

  function materialOf(overrides: Partial<Material> = {}): Material {
    return {
      publicUuid: 'mat-1',
      sectionPublicUuid: 's-1',
      title: 'Material',
      type: MaterialType.Pdf,
      filename: 'doc.pdf',
      sizeBytes: 1024,
      contentType: 'application/pdf',
      url: null,
      uploadedByTeacherPublicUuid: 'tch-1',
      uploadedByTeacherName: 'Prof.',
      downloadUrl: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: null,
      ...overrides,
    };
  }

  function uploadStream(final: Material): Observable<MaterialUploadProgress> {
    return new Observable<MaterialUploadProgress>((sub) => {
      sub.next({ kind: 'Sent' });
      sub.next({ kind: 'Progress', percent: 50, loaded: 50, total: 100 });
      sub.next({ kind: 'Response', value: final });
      sub.complete();
    });
  }

  beforeEach(() => {
    mockApi = jasmine.createSpyObj<MaterialApiService>('MaterialApiService', [
      'listBySection',
      'getMaterial',
      'upload',
      'delete',
    ]);
    mockApi.listBySection.and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [MaterialsStore, { provide: MaterialApiService, useValue: mockApi }],
    });
    store = TestBed.inject(MaterialsStore);
  });

  it('loadBySection carga rows', async () => {
    mockApi.listBySection.and.returnValue(of([rowOf()]));
    await store.loadBySection('s-1');
    expect(store.rows()).toHaveSize(1);
    expect(store.currentSectionUuid()).toBe('s-1');
  });

  it('loadBySection cachea con mismos args', async () => {
    mockApi.listBySection.and.returnValue(of([rowOf()]));
    await store.loadBySection('s-1');
    await store.loadBySection('s-1');
    expect(mockApi.listBySection).toHaveBeenCalledTimes(1);
  });

  it('loadDetail carga selected', async () => {
    mockApi.getMaterial.and.returnValue(of(materialOf()));
    const mat = await store.loadDetail('mat-1');
    expect(mat).toBeTruthy();
    expect(store.selected()?.publicUuid).toBe('mat-1');
  });

  it('upload con progreso y refresca listing', async () => {
    const mat = materialOf();
    mockApi.upload.and.returnValue(uploadStream(mat));
    mockApi.listBySection.and.returnValue(of([]));

    await store.loadBySection('s-1');
    const result = await store.upload('s-1', {
      title: 'Nuevo',
      type: MaterialType.Pdf,
      file: new File(['d'], 'nuevo.pdf', { type: 'application/pdf' }),
      url: null,
    });

    expect(result?.publicUuid).toBe('mat-1');
    expect(store.rows()).toHaveSize(1);
  });

  it('remove filtra el row del listing', async () => {
    mockApi.delete.and.returnValue(of(void 0));
    mockApi.listBySection.and.returnValue(of([rowOf()]));

    await store.loadBySection('s-1');
    expect(store.rows()).toHaveSize(1);

    const ok = await store.remove('mat-1');
    expect(ok).toBeTrue();
    expect(store.rows()).toHaveSize(0);
  });

  it('isEmpty computa correctamente', async () => {
    expect(store.isEmpty()).toBeTrue();
    mockApi.listBySection.and.returnValue(of([rowOf()]));
    await store.loadBySection('s-1');
    expect(store.isEmpty()).toBeFalse();
  });

  it('clearDetail resetea selected', async () => {
    mockApi.getMaterial.and.returnValue(of(materialOf()));
    await store.loadDetail('mat-1');
    store.clearDetail();
    expect(store.selected()).toBeNull();
  });
});
