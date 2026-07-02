import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RubricFormComponent } from './rubric-form.component';
import { RubricsStore } from '../../store';
import { ActivatedRoute, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';

describe('RubricFormComponent', () => {
  let component: RubricFormComponent;
  let fixture: ComponentFixture<RubricFormComponent>;
  let storeSpy: jasmine.SpyObj<RubricsStore>;

  const paramMap = new Map<string, string>();

  beforeEach(async () => {
    storeSpy = jasmine.createSpyObj(
      'RubricsStore',
      ['loadDetail', 'create', 'update', 'clearError', 'clearSelected'],
      {
        saving: signal(false),
        error: signal(null),
      },
    );
    const routeSpy = {
      snapshot: { paramMap },
      paramMap: of({ get: (key: string) => paramMap.get(key) ?? null }),
    };
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [RubricFormComponent],
      providers: [
        { provide: RubricsStore, useValue: storeSpy },
        { provide: ActivatedRoute, useValue: routeSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RubricFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('inicia en modo creación', () => {
    expect(component.title()).toBe('Nueva rúbrica');
    expect(component.existing()).toBeNull();
  });

  describe('title', () => {
    it('muestra "Nueva rúbrica" en creación', () => {
      expect(component.title()).toBe('Nueva rúbrica');
    });

    it('muestra "Editar" si existe', () => {
      component.existing.set({ publicUuid: 'r1', name: 'Test' } as any);
      expect(component.title()).toContain('Editar');
    });
  });

  describe('submitLabel', () => {
    it('retorna "Crear rúbrica" en creación', () => {
      expect(component.submitLabel()).toBe('Crear rúbrica');
    });
  });

  describe('showError', () => {
    it('retorna null si control no tiene errores', () => {
      expect(component.showError('name')).toBeNull();
    });

    it('retorna mensaje de required', () => {
      const ctrl = component.metaForm.get('name');
      ctrl!.setErrors({ required: true });
      ctrl!.markAsTouched();
      expect(component.showError('name')).toBe('Campo requerido.');
    });
  });

  describe('cancel', () => {
    it('limpia error y navega al listado', () => {
      const routerSpy = TestBed.inject(Router);
      component.cancel();
      expect(storeSpy.clearError).toHaveBeenCalled();
      expect(routerSpy.navigate).toHaveBeenCalled();
    });
  });
});
