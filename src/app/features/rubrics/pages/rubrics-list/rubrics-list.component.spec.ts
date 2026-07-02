import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RubricsListComponent } from './rubrics-list.component';
import { RubricsStore } from '../../store';
import { ActivatedRoute, Router } from '@angular/router';
import { signal } from '@angular/core';
import { RubricRow } from '../../models';

describe('RubricsListComponent', () => {
  let component: RubricsListComponent;
  let fixture: ComponentFixture<RubricsListComponent>;
  let storeSpy: jasmine.SpyObj<RubricsStore>;
  let routerSpy: jasmine.SpyObj<Router>;
  let routeSpy: jasmine.SpyObj<ActivatedRoute>;

  const mockRows: RubricRow[] = [
    {
      publicUuid: 'r1',
      name: 'Rúbrica 1',
      description: 'Desc',
      isSystem: false,
      parentRubricPublicUuid: undefined,
      criterionCount: 2,
      criterionSummary: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(async () => {
    storeSpy = jasmine.createSpyObj(
      'RubricsStore',
      ['load', 'setFilters', 'clearFilters', 'clearError', 'loadSystemRubrics', 'remove'],
      {
        rows: signal(mockRows),
        filters: signal({}),
        loading: signal(false),
        error: signal(null),
        hasSystemRubrics: signal(false),
      },
    );
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    routeSpy = jasmine.createSpyObj('ActivatedRoute', [], {
      snapshot: { queryParamMap: new Map() },
    });

    await TestBed.configureTestingModule({
      imports: [RubricsListComponent],
      providers: [
        { provide: RubricsStore, useValue: storeSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: routeSpy },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RubricsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('carga rúbricas al iniciar', () => {
    expect(storeSpy.load).toHaveBeenCalled();
  });

  describe('systemFilterValue', () => {
    it('retorna "all" por defecto', () => {
      expect(component.systemFilterValue()).toBe('all');
    });

    it('retorna "system" si filter es true', () => {
      storeSpy = jasmine.createSpyObj('RubricsStore', ['load', 'setFilters'], {
        filters: signal({ systemOnly: true }),
      });
    });
  });

  describe('onSystemChange', () => {
    it('actualiza filtro systemOnly', async () => {
      storeSpy.setFilters.and.resolveTo();
      await component.onSystemChange('system');
      expect(storeSpy.setFilters).toHaveBeenCalled();
    });
  });

  describe('goToCreate', () => {
    it('navega a /rubrics/new', () => {
      component.goToCreate();
      expect(routerSpy.navigate).toHaveBeenCalled();
    });
  });
});
