import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MaterialUploadDialogComponent } from './material-upload-dialog.component';

describe('MaterialUploadDialogComponent', () => {
  let component: MaterialUploadDialogComponent;
  let fixture: ComponentFixture<MaterialUploadDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialUploadDialogComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(MaterialUploadDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  it('se crea', () => {
    expect(component).toBeTruthy();
    const title = fixture.nativeElement.querySelector('h2');
    expect(title.textContent).toContain('Subir material');
  });

  it('no se renderiza si open es false', () => {
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeNull();
  });

  it('emite submit con CreateMaterialRequest', () => {
    spyOn(component.submit, 'emit');
    component.form.patchValue({ title: 'Mi material', type: 'LINK', url: 'https://ejemplo.com' });
    component.onSubmit();
    expect(component.submit.emit).toHaveBeenCalledWith(
      jasmine.objectContaining({ title: 'Mi material', type: 'LINK', url: 'https://ejemplo.com' }),
    );
  });

  it('no emite si form inválido', () => {
    spyOn(component.submit, 'emit');
    component.onSubmit();
    expect(component.submit.emit).not.toHaveBeenCalled();
  });

  it('emite cancelled al cancelar', () => {
    spyOn(component.cancelled, 'emit');
    component.onCancel();
    expect(component.cancelled.emit).toHaveBeenCalled();
  });

  it('isLinkSelected detecta tipo LINK', () => {
    component.form.patchValue({ type: 'LINK' });
    expect(component.isLinkSelected()).toBeTrue();
    component.form.patchValue({ type: 'PDF' });
    expect(component.isLinkSelected()).toBeFalse();
  });

  it('typeLabel usa materialTypeLabel', () => {
    expect(component.typeLabel('PDF' as any)).toBe('PDF');
    expect(component.typeLabel('LINK' as any)).toBe('Enlace');
  });
});
