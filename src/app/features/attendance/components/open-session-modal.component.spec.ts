import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { OpenSessionModalComponent } from './open-session-modal.component';
import { AcademicApiService } from '@features/academic/services';
import { AcademicYearStatus } from '@features/academic/models';
import { AttendanceSessionSlot } from '../models';

describe('OpenSessionModalComponent', () => {
  let fixture: ComponentFixture<OpenSessionModalComponent>;
  let component: OpenSessionModalComponent;
  let fakeAcademic: jasmine.SpyObj<AcademicApiService>;

  const year = { publicUuid: 'y-1', name: '2026', status: AcademicYearStatus.Active } as any;
  const section = { publicUuid: 'sec-1', gradeName: '1°', name: 'A' } as any;

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

  it('ngOnInit setea occurredOn a hoy', async () => {
    configureModule();
    fakeAcademic.listYears.and.returnValue(of([year]));
    fakeAcademic.listSections.and.returnValue(of([section]));
    await component.ngOnInit();
    expect((component as any).occurredOn).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('ngOnInit carga secciones del año activo', async () => {
    configureModule();
    fakeAcademic.listYears.and.returnValue(of([year]));
    fakeAcademic.listSections.and.returnValue(of([section]));
    await component.ngOnInit();
    expect((component as any).sections()).toHaveSize(1);
    expect((component as any).activeYear()?.publicUuid).toBe('y-1');
  });

  it('ngOnInit sin año activo deja sections vacío', async () => {
    configureModule();
    fakeAcademic.listYears.and.returnValue(of([]));
    await component.ngOnInit();
    expect((component as any).sections()).toEqual([]);
  });

  it('ngOnInit maneja error', async () => {
    configureModule();
    fakeAcademic.listYears.and.throwError('boom');
    await component.ngOnInit();
    expect((component as any).sections()).toEqual([]);
    expect((component as any).loadingSections()).toBeFalse();
  });

  it('canSubmit requiere section + occurredOn', () => {
    configureModule();
    expect((component as any).canSubmit()).toBeFalse();
    (component as any).sectionPublicUuid = 'sec-1';
    (component as any).occurredOn = '2026-06-15';
    expect((component as any).canSubmit()).toBeTrue();
  });

  it('slotOptions expone los 3 valores', () => {
    configureModule();
    const opts = (component as any).slotOptions;
    expect(opts).toHaveSize(3);
    expect(opts[0].value).toBe('MORNING');
  });

  it('submit emite submitRequest con payload', () => {
    configureModule();
    const submitSpy = jasmine.createSpy('submit');
    component.submitRequest.subscribe(submitSpy);
    (component as any).sectionPublicUuid = 'sec-1';
    (component as any).occurredOn = '2026-06-15';
    (component as any).slot = 'AFTERNOON' as AttendanceSessionSlot;
    (component as any).submit();
    expect(submitSpy).toHaveBeenCalledWith({
      sectionPublicUuid: 'sec-1',
      slot: 'AFTERNOON',
      occurredOn: '2026-06-15',
    });
  });

  it('submit sin section no emite', () => {
    configureModule();
    const submitSpy = jasmine.createSpy('submit');
    component.submitRequest.subscribe(submitSpy);
    (component as any).sectionPublicUuid = null;
    (component as any).occurredOn = '2026-06-15';
    (component as any).submit();
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('close emite cancelled', () => {
    configureModule();
    const cancelled = jasmine.createSpy('cancelled');
    component.cancelled.subscribe(cancelled);
    (component as any).close();
    expect(cancelled).toHaveBeenCalled();
  });
});
