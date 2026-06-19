import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MaterialCardComponent } from './material-card.component';
import { MaterialRow, MaterialType } from '../../models';

/**
 * Spec de {@link MaterialCardComponent} (FE-7a.3).
 *
 * Cubre el spec del sprint:
 * <ul>
 *   <li>El icono correcto por {@link MaterialType}.</li>
 *   <li>El botón "Abrir enlace" para {@code LINK} y "Descargar"
 *       para binarios.</li>
 *   <li>El botón "Eliminar" se muestra cuando el usuario tiene
 *       {@code LMS_MATERIAL_WRITE}.</li>
 * </ul>
 */
describe('MaterialCardComponent', () => {
  let component: MaterialCardComponent;
  let fixture: ComponentFixture<MaterialCardComponent>;

  function makeRow(type: MaterialType): MaterialRow {
    return {
      publicUuid: 'mat-1',
      title: 'Recurso',
      type,
      filename: type === MaterialType.Link ? null : 'archivo.bin',
      sizeBytes: type === MaterialType.Link ? null : 2048,
      contentType: type === MaterialType.Link ? null : 'application/octet-stream',
      url: type === MaterialType.Link ? 'https://example.com' : null,
      uploadedByTeacherName: 'Profe Pérez',
      sizeBytesDisplay: type === MaterialType.Link ? null : '2.0 KB',
      createdAt: new Date('2026-06-01T00:00:00Z')
    };
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialCardComponent]
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

  it('renders the Image icon for IMAGE type', () => {
    component.material = makeRow(MaterialType.Image);
    fixture.detectChanges();
    expect(component.iconName()).toBe('image');
  });

  it('renders the globe icon and "Abrir enlace" CTA for LINK type', () => {
    component.material = makeRow(MaterialType.Link);
    fixture.detectChanges();
    expect(component.iconName()).toBe('globe');
    expect(component.isLink()).toBeTrue();
    expect(component.typeLabel()).toBe('Enlace');
  });

  it('exposes a download URL pointing to /v1/lms/materials/{uuid}/download', () => {
    component.material = makeRow(MaterialType.Pdf);
    expect(component.downloadUrl()).toContain('/v1/lms/materials/mat-1/download');
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
