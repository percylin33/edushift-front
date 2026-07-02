import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BulkImportModalComponent } from './bulk-import-modal.component';
import { StudentsStore } from '../store';
import { BulkImportJob } from '../models';
import { BulkImportStatus } from '@core/enums';

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
      startBulkImport: jasmine.createSpy('startBulkImport'),
    };
    TestBed.configureTestingModule({
      imports: [BulkImportModalComponent],
      providers: [{ provide: StudentsStore, useValue: fakeStore }],
    });
    fixture = TestBed.createComponent(BulkImportModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('se crea', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('inicia sin job', () => {
    configureModule();
    expect((component as any).job()).toBeNull();
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

  it('restart resetea store y selectedFileName', () => {
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
  });

  it('onFilePicked setea nombre y llama startBulkImport', async () => {
    configureModule();
    const file = new File(['a,b,c'], 'alumnos.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const event = { target: { files: [file], value: 'ignored' } } as unknown as Event;
    await (component as any).onFilePicked(event);
    expect((component as any)['selectedFileName']()).toBe('alumnos.xlsx');
    expect(fakeStore.startBulkImport).toHaveBeenCalledWith(file);
  });

  it('errorMessage expone store.error', () => {
    configureModule();
    fakeStore.error.set('falló la subida');
    expect((component as any).errorMessage()).toBe('falló la subida');
  });

  it('formatBytes maneja B / KB / MB', () => {
    configureModule();
    expect((component as any).formatBytes(500)).toBe('500 B');
    expect((component as any).formatBytes(2048)).toBe('2.0 KB');
    expect((component as any).formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
