import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { OpenSessionModalComponent } from './open-session-modal.component';
import { AcademicApiService } from '@features/academic/services';
import { AcademicYearRow, AcademicYearStatus, SectionRow } from '@features/academic/models';
import { AttendanceSessionSlot } from '../models';

function testFixture<T>(value: Partial<T>): T {
  return value as T;
}

describe('OpenSessionModalComponent', () => {
  let fixture: ComponentFixture<OpenSessionModalComponent>;
  let component: OpenSessionModalComponent;
  let fakeAcademic: jasmine.SpyObj<AcademicApiService>;

  const year = testFixture<AcademicYearRow>({ publicUuid: 'y-1', name: '2026', status: AcademicYearStatus.Active });
  const section = testFixture<SectionRow>({ publicUuid: 'sec-1', gradeName: '1°', name: 'A' });

  function configureModule(): void {
    fakeAcademic = jasmine.createSpyObj<AcademicApiService>('AcademicApiService', [
      'listYears',
      'listSections',
    ]);
    TestBed.configureTestingModule({
      imports: [OpenSessionModalComponent],
      providers: [{ provide: AcademicApiService, useValue: fakeAcademic }],
    });
    fixture = TestBed.createComponent(OpenSessionModalComponent);
    component = fixture.componentInstance;
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnInit preselecciona sección del año activo', async () => {
    configureModule();
    fakeAcademic.listYears.and.returnValue(of([year]));
    fakeAcademic.listSections.and.returnValue(of([section]));
    await component.ngOnInit();
    expect(component['form'].controls.occurredOn.value).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(component['form'].controls.sectionPublicUuid.value).toBe('sec-1');
  });

  it('ngOnInit carga secciones del año activo', async () => {
    configureModule();
    fakeAcademic.listYears.and.returnValue(of([year]));
    fakeAcademic.listSections.and.returnValue(of([section]));
    await component.ngOnInit();
    expect(component['sections']()).toHaveSize(1);
    expect(component['activeYear']()?.publicUuid).toBe('y-1');
  });

  it('ngOnInit sin año activo deja sections vacío', async () => {
    configureModule();
    fakeAcademic.listYears.and.returnValue(of([]));
    await component.ngOnInit();
    expect(component['sections']()).toEqual([]);
  });

  it('ngOnInit maneja error', async () => {
    configureModule();
    fakeAcademic.listYears.and.returnValue(throwError(() => new Error('boom')));
    await component.ngOnInit();
    expect(component['sections']()).toEqual([]);
    expect(component['loadingSections']()).toBeFalse();
  });

  it('submit emite submitRequest con payload', () => {
    configureModule();
    const submitSpy = jasmine.createSpy('submit');
    component.submitRequest.subscribe(submitSpy);
    component['form'].patchValue({
      sectionPublicUuid: 'sec-1',
      occurredOn: '2026-06-15',
      slot: 'AFTERNOON' as AttendanceSessionSlot,
    });
    component['submit']();
    expect(submitSpy).toHaveBeenCalledWith({
      sectionPublicUuid: 'sec-1',
      slot: 'AFTERNOON',
      occurredOn: '2026-06-15',
    });
  });

  it('submit sin section muestra hint y no emite', () => {
    configureModule();
    const submitSpy = jasmine.createSpy('submit');
    component.submitRequest.subscribe(submitSpy);
    component['form'].patchValue({
      sectionPublicUuid: '',
      occurredOn: '2026-06-15',
    });
    component['submit']();
    expect(submitSpy).not.toHaveBeenCalled();
    expect(component['submitHint']()).toContain('sección');
  });

  it('close emite cancelled', () => {
    configureModule();
    const cancelled = jasmine.createSpy('cancelled');
    component.cancelled.subscribe(cancelled);
    component['close']();
    expect(cancelled).toHaveBeenCalled();
  });
});
