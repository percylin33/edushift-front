import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MaterialsListComponent } from './materials-list.component';
import { MaterialsStore } from '../../store';
import { MaterialRow, MaterialType } from '../../models';

describe('MaterialsListComponent', () => {
  let component: MaterialsListComponent;
  let fixture: ComponentFixture<MaterialsListComponent>;
  let mockStore: jasmine.SpyObj<MaterialsStore>;

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

    await TestBed.configureTestingModule({
      imports: [MaterialsListComponent],
      providers: [provideRouter([]), { provide: MaterialsStore, useValue: mockStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(MaterialsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('onOpenDialog abre dialog', () => {
    expect(component.dialogOpen()).toBeFalse();
    component.onOpenDialog();
    expect(component.dialogOpen()).toBeTrue();
  });

  it('onCancelDialog cierra dialog', () => {
    component.dialogOpen.set(true);
    component.onCancelDialog();
    expect(component.dialogOpen()).toBeFalse();
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
        uploadedByTeacherPublicUuid: 'tch-1',
        uploadedByTeacherName: 'Prof.',
        downloadUrl: null,
        createdAt: new Date(),
        updatedAt: null,
      }),
    );
    component['#sectionUuid'] = 's-1';
    await component.onUpload({
      title: 'Nuevo',
      type: MaterialType.Pdf,
      file: new File(['d'], 'nuevo.pdf', { type: 'application/pdf' }),
      url: null,
    });
    expect(mockStore.upload).toHaveBeenCalled();
    expect(component.dialogOpen()).toBeFalse();
  });

  it('onDelete pide confirmación y llama remove', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    mockStore.remove.and.returnValue(Promise.resolve(true));
    const row: MaterialRow = {
      publicUuid: 'mat-1',
      title: 'Material',
      type: MaterialType.Pdf,
      filename: 'doc.pdf',
      sizeBytes: 1024,
      contentType: 'application/pdf',
      url: null,
      uploadedByTeacherName: 'Prof.',
      sizeBytesDisplay: '1 KB',
      createdAt: new Date(),
    };
    await component.onDelete(row);
    expect(mockStore.remove).toHaveBeenCalledWith('mat-1');
  });

  it('reload llama clearError y loadBySection', () => {
    component['#sectionUuid'] = 's-1';
    component.reload();
    expect(mockStore.clearError).toHaveBeenCalled();
  });
});
