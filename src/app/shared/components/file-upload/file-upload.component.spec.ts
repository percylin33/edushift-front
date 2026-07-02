import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileUploadComponent } from './file-upload.component';
import { HttpClient } from '@angular/common/http';
import { FileUploadService } from '@core/services/file-upload.service';

describe('FileUploadComponent', () => {
  let component: FileUploadComponent;
  let fixture: ComponentFixture<FileUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileUploadComponent],
      providers: [
        { provide: HttpClient, useValue: jasmine.createSpyObj('HttpClient', ['post']) },
        {
          provide: FileUploadService,
          useValue: jasmine.createSpyObj('FileUploadService', ['upload']),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FileUploadComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('module', 'avatars');
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('inicia sin uploading, error ni dragging', () => {
    expect(component.uploading()).toBeFalse();
    expect(component.error()).toBeNull();
    expect(component.dragging()).toBeFalse();
    expect(component.progress()).toBe(0);
  });

  it('inicia con maxSizeMb por defecto 25', () => {
    expect(component.maxSizeMb()).toBe(25);
  });

  it('accept es string vacío por defecto', () => {
    expect(component.accept()).toBe('');
  });

  it('compact es false por defecto', () => {
    expect(component.compact()).toBeFalse();
  });

  it('disabled es false por defecto', () => {
    expect(component.disabled()).toBeFalse();
  });

  it('triggerPicker no hace nada si está deshabilitado', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    component.triggerPicker();
    expect(component.uploading()).toBeFalse();
  });
});
