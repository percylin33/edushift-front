import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RubricDetailComponent } from './rubric-detail.component';
import { RubricsStore } from '../../store';
import { ActivatedRoute, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { RubricDetail } from '../../models';

describe('RubricDetailComponent', () => {
  let component: RubricDetailComponent;
  let fixture: ComponentFixture<RubricDetailComponent>;
  let storeSpy: jasmine.SpyObj<RubricsStore>;

  const mockRubric: RubricDetail = {
    publicUuid: 'r1',
    name: 'Rúbrica Test',
    description: 'Descripción',
    criteria: [
      {
        key: 'c1',
        name: 'Criterio 1',
        weight: 50,
        descriptors: [{ level: 'AD', text: 'Excelente' }],
      },
      { key: 'c2', name: 'Criterio 2', weight: 50, descriptors: [] },
    ],
    levels: [
      { code: 'AD', name: 'Logro destacado' },
      { code: 'A', name: 'Logro esperado' },
    ],
    isSystem: false,
    parentRubricPublicUuid: undefined,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const paramMap = new Map<string, string>();

  beforeEach(async () => {
    storeSpy = jasmine.createSpyObj('RubricsStore', ['loadDetail', 'clearError', 'clearSelected'], {
      selected: signal(mockRubric),
      loadingDetail: signal(false),
      error: signal(null),
    });
    const routeSpy = {
      snapshot: { paramMap },
      paramMap: of({ get: (key: string) => paramMap.get(key) ?? null }),
    };
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [RubricDetailComponent],
      providers: [
        { provide: RubricsStore, useValue: storeSpy },
        { provide: ActivatedRoute, useValue: routeSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RubricDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('muestra el nombre de la rúbrica', () => {
    expect(component.title()).toBe('Rúbrica Test');
  });

  describe('subtitle', () => {
    it('muestra conteo de criterios y niveles', () => {
      expect(component.subtitle()).toContain('2 criterios');
      expect(component.subtitle()).toContain('2 niveles');
    });
  });

  describe('totalWeight', () => {
    it('calcula suma de pesos', () => {
      expect(component.totalWeight()).toBe(100);
    });
  });

  describe('getDescriptor', () => {
    it('encuentra descriptor por levelCode', () => {
      const text = component.getDescriptor(
        [
          { level: 'AD', text: 'Excelente' },
          { level: 'A', text: 'Bien' },
        ],
        'AD',
      );
      expect(text).toBe('Excelente');
    });

    it('retorna vacío si no encuentra', () => {
      const text = component.getDescriptor([], 'AD');
      expect(text).toBe('');
    });
  });

  describe('goBack', () => {
    it('navega al listado', () => {
      const routerSpy = TestBed.inject(Router);
      component.goBack();
      expect(routerSpy.navigate).toHaveBeenCalled();
    });
  });
});
