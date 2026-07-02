import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { TeacherDetailComponent } from './teacher-detail.component';
import { TeachersStore } from '../../store';
import { TeacherDetail } from '../../models';
import { DocumentType, EmploymentStatus, Gender } from '@core/enums';
import { ROUTES } from '@core/constants';

@Component({ template: '', standalone: true })
class DummyComponent {}

describe('TeacherDetailComponent', () => {
  let fixture: ComponentFixture<TeacherDetailComponent>;
  let component: TeacherDetailComponent;
  let router: Router;
  let fakeStore: jasmine.SpyObj<TeachersStore>;

  const teacher: TeacherDetail = {
    publicUuid: 't-1',
    firstName: 'Maria',
    lastName: 'Gomez',
    fullName: 'Maria Gomez',
    documentType: DocumentType.Dni,
    documentNumber: '87654321',
    email: 'maria@test.com',
    phone: '555-0200',
    hireDate: new Date('2025-01-01'),
    employmentStatus: EmploymentStatus.Active,
    title: 'Lic.',
    specializations: ['Matemáticas', 'Física'],
    gender: Gender.Female,
    birthDate: new Date('1985-03-20'),
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2026-06-01'),
  } as any;

  function createStoreSpies(): jasmine.SpyObj<TeachersStore> {
    return jasmine.createSpyObj<TeachersStore>(
      'TeachersStore',
      ['loadDetail', 'clearError', 'delete'],
      {
        selected: signal<TeacherDetail | null>(null),
        loadingDetail: signal(false),
        saving: signal(false),
        inviting: signal(false),
        error: signal<string | null>(null),
      },
    );
  }

  function configureModule(id: string | null = 't-1', tab: string | null = null): void {
    TestBed.resetTestingModule();
    fakeStore = createStoreSpies();
    TestBed.configureTestingModule({
      imports: [TeacherDetailComponent],
      providers: [
        provideRouter([{ path: '**', component: DummyComponent }]),
        { provide: TeachersStore, useValue: fakeStore },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (_k: string) => id },
              queryParamMap: { get: (_k: string) => tab },
            },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(TeacherDetailComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  }

  it('se crea', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnInit carga detalle si store no lo tiene', async () => {
    configureModule();
    fixture.detectChanges();
    await component.ngOnInit();
    expect(fakeStore.loadDetail).toHaveBeenCalledWith('t-1');
  });

  it('ngOnInit no recarga si store ya tiene el teacher', async () => {
    configureModule();
    (fakeStore as any).selected.set(teacher);
    fixture.detectChanges();
    await component.ngOnInit();
    expect(fakeStore.loadDetail).not.toHaveBeenCalled();
  });

  it('ngOnInit sin id redirige al listado', async () => {
    configureModule(null);
    fixture.detectChanges();
    spyOn(router, 'navigate');
    await component.ngOnInit();
    expect(router.navigate).toHaveBeenCalledWith([ROUTES.TEACHERS.LIST]);
  });

  it('ngOnInit usa queryParam tab si válido', async () => {
    configureModule('t-1', 'account');
    (fakeStore as any).selected.set(teacher);
    fixture.detectChanges();
    await component.ngOnInit();
    expect((component as any).activeTab()).toBe('account');
  });

  it('ngOnInit ignora queryParam tab inválido', async () => {
    configureModule('t-1', 'invalidTab');
    (fakeStore as any).selected.set(teacher);
    fixture.detectChanges();
    await component.ngOnInit();
    expect((component as any).activeTab()).toBe('info');
  });

  it('setTab actualiza y navega con query param', () => {
    configureModule();
    fixture.detectChanges();
    spyOn(router, 'navigate');
    (component as any).setTab('assignments');
    expect((component as any).activeTab()).toBe('assignments');
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining({
        queryParams: { tab: 'assignments' },
      }),
    );
  });

  it('openInviteDialog setea showInviteDialog', () => {
    configureModule();
    (component as any).openInviteDialog();
    expect((component as any).showInviteDialog()).toBeTrue();
  });

  it('closeInviteDialog cierra dialog', () => {
    configureModule();
    (component as any)['showInviteDialog'].set(true);
    (component as any).closeInviteDialog();
    expect((component as any).showInviteDialog()).toBeFalse();
  });

  it('openLinkDialog setea showLinkDialog', () => {
    configureModule();
    (component as any).openLinkDialog();
    expect((component as any).showLinkDialog()).toBeTrue();
  });

  it('closeLinkDialog cierra dialog', () => {
    configureModule();
    (component as any)['showLinkDialog'].set(true);
    (component as any).closeLinkDialog();
    expect((component as any).showLinkDialog()).toBeFalse();
  });

  it('onLinked cierra link dialog', () => {
    configureModule();
    (component as any)['showLinkDialog'].set(true);
    (component as any).onLinked();
    expect((component as any).showLinkDialog()).toBeFalse();
  });

  it('onDelete confirma y navega al listado si ok', async () => {
    configureModule();
    (fakeStore as any).selected.set(teacher);
    fakeStore.delete.and.returnValue(Promise.resolve(true));
    spyOn(router, 'navigate');
    spyOn(window, 'confirm').and.returnValue(true);

    await (component as any).onDelete();
    expect(fakeStore.delete).toHaveBeenCalledWith('t-1');
    expect(router.navigate).toHaveBeenCalledWith([ROUTES.TEACHERS.LIST]);
  });

  it('onDelete no borra si confirm false', async () => {
    configureModule();
    (fakeStore as any).selected.set(teacher);
    spyOn(window, 'confirm').and.returnValue(false);
    await (component as any).onDelete();
    expect(fakeStore.delete).not.toHaveBeenCalled();
  });

  it('editRoute retorna ruta correcta', () => {
    configureModule();
    expect((component as any).editRoute('t-1')).toBe('/teachers/t-1/edit');
  });

  it('subtitle formatea documento + título', () => {
    configureModule();
    expect((component as any).subtitle(teacher)).toContain('DNI');
  });

  it('genderLabel mapea correctamente', () => {
    configureModule();
    expect((component as any).genderLabel(Gender.Female)).toBe('Femenino');
    expect((component as any).genderLabel(undefined)).toBe('—');
  });

  it('listRoute es /teachers', () => {
    configureModule();
    expect((component as any).listRoute).toBe('/teachers');
  });
});
