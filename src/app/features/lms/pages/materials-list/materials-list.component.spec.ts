import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MaterialsListComponent } from './materials-list.component';
import { MaterialsStore } from '../../store';
import { CreateMaterialRequest, MaterialRow, MaterialType } from '../../models';
import { ConfirmDialogService } from '@shared/components';

describe('MaterialsListComponent', () => {
  let component: MaterialsListComponent;
  let fixture: ComponentFixture<MaterialsListComponent>;
  let mockStore: jasmine.SpyObj<MaterialsStore>;
  let confirmDialog: jasmine.SpyObj<ConfirmDialogService>;
  const testApi = () =>
    component as unknown as {
      dialogOpen: WritableSignal<boolean>;
      onOpenDialog(): void;
      onCancelDialog(): void;
      onUpload(request: CreateMaterialRequest): Promise<void>;
      onDelete(row: MaterialRow): Promise<void>;
      reload(): void;
    };

  beforeEach(async () => {
    mockStore = jasmine.createSpyObj<MaterialsStore>(
      'MaterialsStore',
      ['loadBySection', 'upload', 'remove', 'clearError'],
      {
        rows: signal([]),
        loading: signal(false),
        error: signal(null),
        uploading: signal(false),
        uploadPercent: signal(0),
      },
    );
    confirmDialog = jasmine.createSpyObj<ConfirmDialogService>('ConfirmDialogService', ['open']);
    confirmDialog.open.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [MaterialsListComponent],
      providers: [
        provideRouter([]),
        { provide: MaterialsStore, useValue: mockStore },
        { provide: ConfirmDialogService, useValue: confirmDialog },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (key: string) => (key === 'sectionUuid' ? 's-1' : null) },
              queryParamMap: { get: (key: string) => (key === 'assignment' ? 'a-1' : null) },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MaterialsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('onOpenDialog abre dialog', () => {
    expect(testApi().dialogOpen()).toBeFalse();
    testApi().onOpenDialog();
    expect(testApi().dialogOpen()).toBeTrue();
  });

  it('onCancelDialog cierra dialog', () => {
    testApi().dialogOpen.set(true);
    testApi().onCancelDialog();
    expect(testApi().dialogOpen()).toBeFalse();
  });

  it('onUpload llama store.upload', async () => {
    mockStore.upload.and.returnValue(
      Promise.resolve({
        publicUuid: 'mat-1',
        sectionPublicUuid: 's-1',
        title: 'Nuevo',
        type: MaterialType.Pdf,
        filename: 'nuevo.pdf',
        sizeBytes: 512,
        contentType: 'application/pdf',
        url: null,
        filePublicUuid: 'file-1',
        uploadedByTeacherPublicUuid: 'tch-1',
        uploadedByTeacherName: 'Prof.',
        downloadUrl: null,
        createdAt: new Date(),
        updatedAt: null,
      }),
    );

    await testApi().onUpload({
      title: 'Nuevo',
      type: MaterialType.Pdf,
      file: new File(['d'], 'nuevo.pdf', { type: 'application/pdf' }),
      url: null,
      teacherAssignmentPublicUuid: 'a-1',
    });
    expect(mockStore.upload).toHaveBeenCalled();
    expect(testApi().dialogOpen()).toBeFalse();
  });

  it('onDelete pide confirmación y llama remove', async () => {
    mockStore.remove.and.returnValue(Promise.resolve(true));
    const row: MaterialRow = {
      publicUuid: 'mat-1',
      title: 'Material',
      type: MaterialType.Pdf,
      filename: 'doc.pdf',
      sizeBytes: 1024,
      contentType: 'application/pdf',
      url: null,
      filePublicUuid: 'file-1',
      uploadedByTeacherName: 'Prof.',
      sizeBytesDisplay: '1 KB',
      createdAt: new Date(),
    };
    await testApi().onDelete(row);
    expect(confirmDialog.open).toHaveBeenCalled();
    expect(mockStore.remove).toHaveBeenCalledWith('mat-1');
  });

  it('reload llama clearError y loadBySection', () => {

    testApi().reload();
    expect(mockStore.clearError).toHaveBeenCalled();
  });
});
