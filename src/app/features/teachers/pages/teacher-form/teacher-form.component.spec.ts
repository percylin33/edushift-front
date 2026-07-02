import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TeacherFormComponent } from './teacher-form.component';
import { TeachersStore } from '../../store';
import { TeacherDetail, CreateTeacherRequest, UpdateTeacherRequest } from '../../models';
import { DocumentType, EmploymentStatus, Gender } from '@core/enums';
import { ROUTES } from '@core/constants';

@Component({ template: '', standalone: true })
class DummyComponent {}

describe('TeacherFormComponent', () => {
  let fixture: ComponentFixture<TeacherFormComponent>;
  let component: TeacherFormComponent;
  let fakeStore: jasmine.SpyObj<TeachersStore>;
  let router: Router;

  const detail: TeacherDetail = {
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
    specializations: ['Matemáticas'],
    gender: Gender.Female,
    birthDate: new Date('1985-03-20'),
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2026-06-01'),
  } as any;

  function createStoreSpies(): jasmine.SpyObj<TeachersStore> {
    return jasmine.createSpyObj<TeachersStore>(
      'TeachersStore',
      ['clearError', 'loadDetail', 'create', 'update'],
      {
        saving: signal(false),
        loadingDetail: signal(false),
        error: signal<string | null>(null),
      },
    );
  }

  function configureModule(id: string | null = null): void {
    TestBed.resetTestingModule();
    fakeStore = createStoreSpies();
    TestBed.configureTestingModule({
      imports: [TeacherFormComponent],
      providers: [
        provideRouter([{ path: '**', component: DummyComponent }]),
        { provide: TeachersStore, useValue: fakeStore },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (_k: string) => id } } },
        },
      ],
    });
    fixture = TestBed.createComponent(TeacherFormComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  }

  it('se crea', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  describe('modo create', () => {
    it('ngOnInit inicializa sin cargar detalle', async () => {
      configureModule();
      await component.ngOnInit();
      expect(fakeStore.clearError).toHaveBeenCalled();
      expect((component as any).editing()).toBeFalse();
      expect(fakeStore.loadDetail).not.toHaveBeenCalled();
    });

    it('title/subtitle en create', () => {
      configureModule();
      expect((component as any).title()).toBe('Nuevo docente');
      expect((component as any).submitLabel()).toBe('Crear docente');
    });

    it('onSubmit inválido no llama create', async () => {
      configureModule();
      await (component as any).onSubmit();
      expect(fakeStore.create).not.toHaveBeenCalled();
    });

    it('onSubmit llama create y navega a detail', async () => {
      configureModule();
      await component.ngOnInit();
      const created: TeacherDetail = { publicUuid: 't-1' } as any;
      fakeStore.create.and.returnValue(Promise.resolve(created));
      spyOn(router, 'navigate');

      (component as any).form.patchValue({
        documentNumber: '12345678',
        firstName: 'Juan',
        lastName: 'Perez',
      });
      await (component as any).onSubmit();

      expect(fakeStore.create).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({
          documentNumber: '12345678',
          firstName: 'Juan',
          lastName: 'Perez',
        }),
      );
      expect(router.navigate).toHaveBeenCalledWith([ROUTES.TEACHERS.detail('t-1')]);
    });

    it('onSubmit create falla sin navegar', async () => {
      configureModule();
      await component.ngOnInit();
      fakeStore.create.and.returnValue(Promise.resolve(null));
      spyOn(router, 'navigate');

      (component as any).form.patchValue({
        documentNumber: '12345678',
        firstName: 'Juan',
        lastName: 'Perez',
      });
      await (component as any).onSubmit();

      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('modo edit', () => {
    it('ngOnInit hidrata form desde detail', async () => {
      configureModule('t-1');
      fakeStore.loadDetail.and.returnValue(Promise.resolve(detail));
      await component.ngOnInit();

      expect((component as any).editing()).toBeTrue();
      expect((component as any).form.get('firstName')?.value).toBe('Maria');
      expect((component as any).form.get('documentNumber')?.value).toBe('87654321');
      expect((component as any).form.get('specializations')?.value).toEqual(['Matemáticas']);
    });

    it('loadDetail nulo redirige al listado', async () => {
      configureModule('t-1');
      fakeStore.loadDetail.and.returnValue(Promise.resolve(null));
      spyOn(router, 'navigate');
      await component.ngOnInit();
      expect(router.navigate).toHaveBeenCalledWith([ROUTES.TEACHERS.LIST]);
    });

    it('title/subtitle en edit', () => {
      configureModule();
      (component as any).editing.set(true);
      expect((component as any).title()).toBe('Editar docente');
      expect((component as any).submitLabel()).toBe('Guardar cambios');
    });

    it('onSubmit llama update y navega', async () => {
      configureModule('t-1');
      fakeStore.loadDetail.and.returnValue(Promise.resolve(detail));
      await component.ngOnInit();

      fakeStore.update.and.returnValue(Promise.resolve(detail));
      spyOn(router, 'navigate');

      await (component as any).onSubmit();
      expect(fakeStore.update).toHaveBeenCalledWith('t-1', jasmine.any(Object));
      expect(router.navigate).toHaveBeenCalledWith([ROUTES.TEACHERS.detail('t-1')]);
    });
  });

  describe('showError', () => {
    it('retorna null para control sin errores', () => {
      configureModule();
      expect((component as any).showError('firstName')).toBeNull();
    });

    it('retorna mensaje para required', () => {
      configureModule();
      const ctrl = (component as any).form.get('documentNumber')!;
      ctrl.markAsTouched();
      expect((component as any).showError('documentNumber')).toBe('Campo requerido.');
    });

    it('retorna mensaje para pattern phone', () => {
      configureModule();
      const ctrl = (component as any).form.get('phone')!;
      ctrl.setValue('a');
      ctrl.markAsTouched();
      expect((component as any).showError('phone')).toContain('Formato inválido');
    });
  });

  describe('applyServerErrors', () => {
    it('mapea TEACHER_DOCUMENT_TAKEN', () => {
      configureModule();
      const err = new HttpErrorResponse({
        error: { errors: [{ code: 'TEACHER_DOCUMENT_TAKEN', message: 'ya existe' }] },
      });
      (component as any)['applyServerErrors'](err);
      expect((component as any)['fieldErrors']()['documentNumber']).toContain('documento');
    });

    it('mapea TEACHER_EMAIL_TAKEN', () => {
      configureModule();
      const err = new HttpErrorResponse({
        error: { errors: [{ code: 'TEACHER_EMAIL_TAKEN', message: 'email en uso' }] },
      });
      (component as any)['applyServerErrors'](err);
      expect((component as any)['fieldErrors']()['email']).toContain('email');
    });
  });

  it('toDateInput formatea correcto', () => {
    configureModule();
    expect((component as any).toDateInput(new Date('2025-01-01T00:00:00'))).toBe('2025-01-01');
  });

  it('toDateInput null retorna null', () => {
    configureModule();
    expect((component as any).toDateInput(undefined)).toBeNull();
  });

  it('listRoute es /teachers', () => {
    configureModule();
    expect((component as any).listRoute).toBe('/teachers');
  });
});
