import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import type { Signal, WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { BulkImportModalComponent } from './bulk-import-modal.component';
import { StudentsStore } from '../store';
import { BulkImportJob } from '../models';
import { BulkImportStatus } from '@core/enums';
import { AcademicApiService } from '@features/academic/services';
import { StudentsApiService } from '../services';

type BulkImportTestSurface = {
  job: Signal<BulkImportJob | null>;
  step: WritableSignal<'destination' | 'file' | 'mapping' | 'progress'>;
  progressPercent: Signal<number | null>;
  selectedFileName: WritableSignal<string | null>;
  selectedFile: WritableSignal<File | null>;
  mapping: WritableSignal<Record<string, string>>;
  confirmBlockers: Signal<string[]>;
  canConfirmMapping: () => boolean;
  errorMessage: Signal<string | null>;
  close: () => void;
  restart: () => void;
  onFilePicked: (event: Event) => Promise<void>;
  setNameMode: (mode: 'split' | 'full') => void;
  toggleGuardian: () => void;
  formatBytes: (bytes: number) => string;
};

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

  function testSurface(): BulkImportTestSurface {
    return component as unknown as BulkImportTestSurface;
  }

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
    expect(testSurface().job()).toBeNull();
    expect(testSurface().step()).toBe('destination');
    expect(testSurface().progressPercent()).toBeNull();
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
      errors: [{ row: 1, code: 'INVALID_ROW', message: 'x' }],
      startedAt: new Date(),
      finishedAt: undefined,
      createdAt: new Date(),
    } satisfies BulkImportJob);
    testSurface().step.set('progress');
    expect(testSurface().progressPercent()).toBe(70);
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
    } satisfies BulkImportJob);
    expect(testSurface().progressPercent()).toBeNull();
  });

  it('close emite closed y limpia error', () => {
    configureModule();
    const closeSpy = jasmine.createSpy('closed');
    component.closed.subscribe(closeSpy);
    testSurface().close();
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
    } satisfies BulkImportJob);
    testSurface().selectedFileName.set('alumnos.xlsx');
    testSurface().restart();
    expect(fakeStore.resetBulkImport).toHaveBeenCalled();
    expect(testSurface().selectedFileName()).toBeNull();
    expect(testSurface().step()).toBe('destination');
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
    await testSurface().onFilePicked(event);
    expect(testSurface().selectedFileName()).toBe('alumnos.xlsx');
    expect(fakeStore.previewBulkImport).toHaveBeenCalledWith(file);
    expect(testSurface().step()).toBe('mapping');
    expect(fakeStore.startBulkImport).not.toHaveBeenCalled();
  });

  it('errorMessage expone store.error', () => {
    configureModule();
    fakeStore.error.set('falló la subida');
    expect(testSurface().errorMessage()).toBe('falló la subida');
  });

  it('explica por qué confirmar queda deshabilitado', () => {
    configureModule();
    testSurface().selectedFile.set(new File(['x'], 'alumnos.xlsx'));
    testSurface().mapping.set({
      documentNumber: 'DNI',
      firstName: 'Nombres',
      lastName: 'Apellido',
      guardianPhone: 'Teléfono apoderado',
    });
    const blockers = testSurface().confirmBlockers();
    expect(blockers.some((line) => line.includes('Tipo de documento'))).toBeTrue();
    expect(blockers.some((line) => line.includes('Falta asignar del apoderado'))).toBeTrue();
    expect(testSurface().canConfirmMapping()).toBeFalse();
  });

  it('permite confirmar si el alumno está completo y el apoderado no se usa', () => {
    configureModule();
    testSurface().selectedFile.set(new File(['x'], 'alumnos.xlsx'));
    testSurface().mapping.set({
      documentType: 'Tipo de documento',
      documentNumber: 'DNI',
      firstName: 'Nombres',
      lastName: 'Apellido',
    });
    expect(testSurface().confirmBlockers()).toEqual([]);
    expect(testSurface().canConfirmMapping()).toBeTrue();
  });

  it('nombre completo no exige nombres y apellidos por separado', () => {
    configureModule();
    testSurface().selectedFile.set(new File(['x'], 'alumnos.xlsx'));
    testSurface().setNameMode('full');
    testSurface().mapping.set({
      documentType: 'Tipo',
      documentNumber: 'DNI',
      fullName: 'Alumno',
    });
    expect(testSurface().confirmBlockers()).toEqual([]);
    expect(testSurface().canConfirmMapping()).toBeTrue();
  });

  it('quitar apoderado libera la confirmación', () => {
    configureModule();
    testSurface().selectedFile.set(new File(['x'], 'alumnos.xlsx'));
    testSurface().mapping.set({
      documentType: 'Tipo',
      documentNumber: 'DNI',
      firstName: 'Ana',
      lastName: 'López',
      guardianPhone: 'Teléfono',
    });
    expect(testSurface().canConfirmMapping()).toBeFalse();
    testSurface().toggleGuardian();
    expect(testSurface().mapping()['guardianPhone']).toBeUndefined();
    expect(testSurface().canConfirmMapping()).toBeTrue();
  });

  it('formatBytes maneja B / KB / MB', () => {
    configureModule();
    expect(testSurface().formatBytes(500)).toBe('500 B');
    expect(testSurface().formatBytes(2048)).toBe('2.0 KB');
    expect(testSurface().formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
