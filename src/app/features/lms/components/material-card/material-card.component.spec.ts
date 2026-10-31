import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MaterialCardComponent } from './material-card.component';
import { MaterialRow, MaterialType } from '../../models';
import { FileUploadService } from '@core/services/file-upload.service';

describe('MaterialCardComponent', () => {
  let component: MaterialCardComponent;
  let fixture: ComponentFixture<MaterialCardComponent>;
  let files: jasmine.SpyObj<FileUploadService>;

  function makeRow(type: MaterialType): MaterialRow {
    return {
      publicUuid: 'mat-1',
      title: 'Recurso',
      type,
      filename: type === MaterialType.Link ? null : 'archivo.bin',
      sizeBytes: type === MaterialType.Link ? null : 2048,
      contentType: type === MaterialType.Link ? null : 'application/octet-stream',
      url: type === MaterialType.Link ? 'https://example.com' : null,
      filePublicUuid: type === MaterialType.Link ? null : 'file-1',
      uploadedByTeacherName: 'Profe Pérez',
      sizeBytesDisplay: type === MaterialType.Link ? null : '2.0 KB',
      createdAt: new Date('2026-06-01T00:00:00Z'),
    };
  }

  beforeEach(async () => {
    files = jasmine.createSpyObj<FileUploadService>('FileUploadService', ['downloadAndSave']);
    files.downloadAndSave.and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      imports: [MaterialCardComponent],
      providers: [{ provide: FileUploadService, useValue: files }],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MaterialCardComponent);
    component = fixture.componentInstance;
  });

  it('renders the PDF icon for PDF type', () => {
    component.material = makeRow(MaterialType.Pdf);
    fixture.detectChanges();
    expect(component.iconName()).toBe('file-text');
    expect(component.typeLabel()).toBe('PDF');
    expect(component.isLink()).toBeFalse();
  });

  it('renders the globe icon and "Abrir enlace" CTA for LINK type', () => {
    component.material = makeRow(MaterialType.Link);
    fixture.detectChanges();
    expect(component.iconName()).toBe('globe');
    expect(component.isLink()).toBeTrue();
    expect(component.typeLabel()).toBe('Enlace');
  });

  it('calls downloadAndSave with filePublicUuid for file materials', async () => {
    component.material = makeRow(MaterialType.Pdf);
    await component.onDownload();
    expect(files.downloadAndSave).toHaveBeenCalledWith('file-1', 'archivo.bin');
  });

  it('emits delete when the delete button is clicked', () => {
    const row = makeRow(MaterialType.Pdf);
    component.material = row;
    fixture.detectChanges();
    spyOn(component.delete, 'emit');
    component.onDelete();
    expect(component.delete.emit).toHaveBeenCalledOnceWith(row);
  });
});
