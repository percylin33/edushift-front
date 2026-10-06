import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { BulkImportModalComponent } from './bulk-import-modal.component';
import { StudentsStore } from '../store';
import { BulkImportJob } from '../models';
import { BulkImportStatus } from '@core/enums';
import { AcademicApiService } from '@features/academic/services';
import { StudentsApiService } from '../services';

describe('BulkImportModalComponent', () => {
  let fixture: ComponentFixture<BulkImportModalComponent>;
  let component: BulkImportModalComponent;
  let fakeStore: {
    bulkJob: ReturnType<typeof signal<BulkImportJob | null>>;
    bulkUploading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    clearError: jasmine.Spy;
    resetBulkImport: jasmine.Spy;
    downloadTemplate: jasmine.Spy;
    previewBulkImport: jasmine.Spy;
    startBulkImport: jasmine.Spy;
  };

  function configureModule(): void {
    fakeStore = {
      bulkJob: signal<BulkImportJob | null>(null),
      bulkUploading: signal(false),
      error: signal<string | null>(null),
      clearError: jasmine.createSpy('clearError'),
      resetBulkImport: jasmine.createSpy('resetBulkImport'),
      downloadTemplate: jasmine.createSpy('downloadTemplate'),
      previewBulkImport: jasmine.createSpy('previewBulkImport'),
      startBulkImport: jasmine.createSpy('startBulkImport'),
    };
    TestBed.configureTestingModule({
      imports: [BulkImportModalComponent],
      providers: [
        { provide: StudentsStore, useValue: fakeStore },
        {
          provide: AcademicApiService,
          useValue: {
            listYears: () => of([]),
            listSections: () => of([]),
          },
        },
        {
          provide: StudentsApiService,
          useValue: {
            create: () => of({ publicUuid: 'stu-1' }),
            createEnrollment: () => of({}),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(BulkImportModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('se crea', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('inicia en destino sin job', async () => {
    configureModule();
    await fixture.whenStable();
    expect((component as any).job()).toBeNull();
    expect((component as any).step()).toBe('destination');
    expect((component as any).progressPercent()).toBeNull();
  });

  it('progressPercent calcula correcto', () => {
    configureModule();
    fakeStore.bulkJob.set({
      publicUuid: 'j-1',
      jobType: 'STUDENTS',
      fileName: 'alumnos.xlsx',
      fileSizeBytes: 50000,
      status: BulkImportStatus.Processing,
      totalRows: 100,
      processedRows: 60,
      errorRows: 10,
      errors: ['x' as any],
      startedAt: new Date(),
      finishedAt: undefined,
      createdAt: new Date(),
    } as unknown as BulkImportJob);
    (component as any).step.set('progress');
    expect((component as any).progressPercent()).toBe(70);
  });

  it('progressPercent null si sin totalRows', () => {
    configureModule();
    fakeStore.bulkJob.set({
      publicUuid: 'j-1',
      jobType: 'STUDENTS',
      fileName: 'alumnos.xlsx',
      fileSizeBytes: 50000,
      status: BulkImportStatus.Pending,
      totalRows: undefined,
      processedRows: 0,
      errorRows: 0,
      errors: [],
      finishedAt: undefined,
      createdAt: new Date(),
    } as unknown as BulkImportJob);
    expect((component as any).progressPercent()).toBeNull();
  });

  it('close emite closed y limpia error', () => {
    configureModule();
    const closeSpy = jasmine.createSpy('closed');
    component.closed.subscribe(closeSpy);
    (component as any).close();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('restart resetea store y vuelve a destino', () => {
    configureModule();
    fakeStore.bulkJob.set({
      publicUuid: 'j-1',
      jobType: 'STUDENTS',
      fileName: 'alumnos.xlsx',
      fileSizeBytes: 50000,
      status: BulkImportStatus.Completed,
      totalRows: 10,
      processedRows: 10,
      errorRows: 0,
      errors: [],
      startedAt: new Date(),
      finishedAt: new Date(),
      createdAt: new Date(),
    } as unknown as BulkImportJob);
    (component as any)['selectedFileName'].set('alumnos.xlsx');
    (component as any).restart();
    expect(fakeStore.resetBulkImport).toHaveBeenCalled();
    expect((component as any)['selectedFileName']()).toBeNull();
    expect((component as any).step()).toBe('destination');
  });

  it('onFilePicked hace preview y pasa a mapeo', async () => {
    configureModule();
    const file = new File(['a,b,c'], 'alumnos.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fakeStore.previewBulkImport.and.resolveTo({
      headers: ['Nombres', 'Apellido paterno', 'Número de documento', 'Tipo de documento'],
      sampleRows: [],
      suggestedMapping: {
        firstName: 'Nombres',
        lastName: 'Apellido paterno',
        documentNumber: 'Número de documento',
        documentType: 'Tipo de documento',
      },
      unmappedRequired: [],
    });
    const event = { target: { files: [file], value: 'ignored' } } as unknown as Event;
    await (component as any).onFilePicked(event);
    expect((component as any)['selectedFileName']()).toBe('alumnos.xlsx');
    expect(fakeStore.previewBulkImport).toHaveBeenCalledWith(file);
    expect((component as any).step()).toBe('mapping');
    expect(fakeStore.startBulkImport).not.toHaveBeenCalled();
  });

  it('errorMessage expone store.error', () => {
    configureModule();
    fakeStore.error.set('falló la subida');
    expect((component as any).errorMessage()).toBe('falló la subida');
  });

  it('explica por qué confirmar queda deshabilitado', () => {
    configureModule();
    (component as any).selectedFile.set(new File(['x'], 'alumnos.xlsx'));
    (component as any).mapping.set({
      documentNumber: 'DNI',
      firstName: 'Nombres',
      lastName: 'Apellido',
      guardianPhone: 'Teléfono apoderado',
    });
    const blockers = (component as any).confirmBlockers() as string[];
    expect(blockers.some((line) => line.includes('Tipo de documento'))).toBeTrue();
    expect(blockers.some((line) => line.includes('Falta asignar del apoderado'))).toBeTrue();
    expect((component as any).canConfirmMapping()).toBeFalse();
  });

  it('permite confirmar si el alumno está completo y el apoderado no se usa', () => {
    configureModule();
    (component as any).selectedFile.set(new File(['x'], 'alumnos.xlsx'));
    (component as any).mapping.set({
      documentType: 'Tipo de documento',
      documentNumber: 'DNI',
      firstName: 'Nombres',
      lastName: 'Apellido',
    });
    expect((component as any).confirmBlockers()).toEqual([]);
    expect((component as any).canConfirmMapping()).toBeTrue();
  });

  it('nombre completo no exige nombres y apellidos por separado', () => {
    configureModule();
    (component as any).selectedFile.set(new File(['x'], 'alumnos.xlsx'));
    (component as any).setNameMode('full');
    (component as any).mapping.set({
      documentType: 'Tipo',
      documentNumber: 'DNI',
      fullName: 'Alumno',
    });
    expect((component as any).confirmBlockers()).toEqual([]);
    expect((component as any).canConfirmMapping()).toBeTrue();
  });

  it('quitar apoderado libera la confirmación', () => {
    configureModule();
    (component as any).selectedFile.set(new File(['x'], 'alumnos.xlsx'));
    (component as any).mapping.set({
      documentType: 'Tipo',
      documentNumber: 'DNI',
      firstName: 'Ana',
      lastName: 'López',
      guardianPhone: 'Teléfono',
    });
    expect((component as any).canConfirmMapping()).toBeFalse();
    (component as any).toggleGuardian();
    expect((component as any).mapping()['guardianPhone']).toBeUndefined();
    expect((component as any).canConfirmMapping()).toBeTrue();
  });

  it('formatBytes maneja B / KB / MB', () => {
    configureModule();
    expect((component as any).formatBytes(500)).toBe('500 B');
    expect((component as any).formatBytes(2048)).toBe('2.0 KB');
    expect((component as any).formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
