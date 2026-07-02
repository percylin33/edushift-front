import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AttendanceSessionsListPageComponent } from './attendance-sessions-list.page';
import { AttendanceStore, AttendanceSessionListFilters } from '../../store';
import { AttendanceApiService } from '../../services';
import { AcademicApiService } from '@features/academic/services';
import { AcademicYearStatus } from '@features/academic/models';

describe('AttendanceSessionsListPageComponent', () => {
  let fixture: ComponentFixture<AttendanceSessionsListPageComponent>;
  let component: AttendanceSessionsListPageComponent;
  let fakeStore: {
    listItems: ReturnType<typeof signal<unknown[]>>;
    hasListItems: ReturnType<typeof signal<boolean>>;
    loadingList: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    applyListFilters: jasmine.Spy;
  };
  let fakeAcademic: jasmine.SpyObj<AcademicApiService>;

  function configureModule(): void {
    fakeStore = {
      listItems: signal([]),
      hasListItems: signal(false),
      loadingList: signal(false),
      error: signal<string | null>(null),
      applyListFilters: jasmine.createSpy('applyListFilters').and.returnValue(Promise.resolve()),
    };
    fakeAcademic = jasmine.createSpyObj<AcademicApiService>('AcademicApiService', [
      'listYears',
      'listSections',
    ]);
    TestBed.configureTestingModule({
      imports: [AttendanceSessionsListPageComponent],
      providers: [
        provideRouter([]),
        { provide: AttendanceStore, useValue: fakeStore },
        { provide: AcademicApiService, useValue: fakeAcademic },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (_: string) => null } } },
        },
      ],
    });
    fixture = TestBed.createComponent(AttendanceSessionsListPageComponent);
    component = fixture.componentInstance;
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnInit hidrata date con hoy y carga secciones', async () => {
    configureModule();
    fakeAcademic.listYears.and.returnValue(
      of([{ publicUuid: 'y-1', name: '2026', status: AcademicYearStatus.Active } as any]),
    );
    fakeAcademic.listSections.and.returnValue(
      of([{ publicUuid: 'sec-1', gradeName: '1°', name: 'A' } as any]),
    );
    await component.ngOnInit();
    expect((component as any).date).toBeTruthy();
    expect(fakeStore.applyListFilters).toHaveBeenCalled();
  });

  it('ngOnInit sin año activo deja sections vacío', async () => {
    configureModule();
    fakeAcademic.listYears.and.returnValue(of([]));
    await component.ngOnInit();
    expect((component as any).sections()).toEqual([]);
  });

  it('ngOnInit maneja error cargando secciones', async () => {
    configureModule();
    fakeAcademic.listYears.and.throwError('boom');
    await component.ngOnInit();
    expect((component as any).sections()).toEqual([]);
    expect((component as any).loadingSections()).toBeFalse();
  });

  it('openModal y closeModal alternan modalOpen', () => {
    configureModule();
    (component as any).openModal();
    expect((component as any).modalOpen()).toBeTrue();
    (component as any).closeModal();
    expect((component as any).modalOpen()).toBeFalse();
  });

  it('sessionRoute retorna ruta del detalle', () => {
    configureModule();
    expect((component as any).sessionRoute('sess-1')).toContain('sess-1');
  });

  it('applyFilters navega y aplica filtros', async () => {
    configureModule();
    await (component as any).applyFilters();
    expect(fakeStore.applyListFilters).toHaveBeenCalled();
  });

  it('onCreate llama al store.openSession y navega', async () => {
    configureModule();
    fakeStore.listItems.set([]);
    (component as any).sections.set([]);
    (component as any).modalOpen.set(true);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl');
    (component as any).store.openSession = jasmine
      .createSpy('openSession')
      .and.returnValue(Promise.resolve({ publicUuid: 'sess-new' } as any));
    await (component as any).onCreate({
      sectionPublicUuid: 'sec-1',
      slot: 'MORNING',
      occurredOn: '2026-06-15',
    });
    expect(router.navigateByUrl).toHaveBeenCalled();
  });
});
