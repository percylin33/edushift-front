import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GradeRecordsPageComponent } from './grade-records-page.component';
import { GradeRecordsStore } from '../../store';
import { EvaluationsApiService } from '@features/evaluations/services';
import { ActivatedRoute, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { EvaluationScale, EvaluationStatus } from '@features/evaluations/models';

describe('GradeRecordsPageComponent', () => {
  let component: GradeRecordsPageComponent;
  let fixture: ComponentFixture<GradeRecordsPageComponent>;
  let storeSpy: jasmine.SpyObj<GradeRecordsStore>;
  let evaluationsApiSpy: jasmine.SpyObj<EvaluationsApiService>;

  const paramMap = new Map<string, string>();

  beforeEach(async () => {
    storeSpy = jasmine.createSpyObj(
      'GradeRecordsStore',
      [
        'loadByEvaluation',
        'upsert',
        'update',
        'remove',
        'bulkUpsert',
        'clear',
        'clearError',
        'clearBulkSummary',
      ],
      {
        rows: signal([]),
        loading: signal(false),
        saving: signal(false),
        error: signal(null),
        lastBulk: signal(null),
        counts: signal({ total: 0, active: 0 }),
        busyRowUuids: signal(new Set()),
      },
    );
    evaluationsApiSpy = jasmine.createSpyObj('EvaluationsApiService', ['getEvaluation']);
    evaluationsApiSpy.getEvaluation.and.returnValue(
      of({
        publicUuid: 'e1',
        name: 'Examen 1',
        scale: EvaluationScale.SCORE_0_20,
        status: EvaluationStatus.DRAFT,
        assignment: { label: 'Test' },
      }),
    );

    const routeSpy = {
      snapshot: { paramMap },
      paramMap: of({ get: (key: string) => paramMap.get(key) ?? null }),
    };
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [GradeRecordsPageComponent],
      providers: [
        { provide: GradeRecordsStore, useValue: storeSpy },
        { provide: EvaluationsApiService, useValue: evaluationsApiSpy },
        { provide: ActivatedRoute, useValue: routeSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GradeRecordsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('carga evaluation y grade records al iniciar', () => {
    expect(evaluationsApiSpy.getEvaluation).toHaveBeenCalled();
    expect(storeSpy.loadByEvaluation).toHaveBeenCalled();
  });

  describe('canEdit', () => {
    it('retorna true si evaluation es DRAFT', () => {
      expect(component.canEdit()).toBeTrue();
    });

    it('retorna false si no hay evaluation', () => {
      component['evaluation'].set(null);
      expect(component.canEdit()).toBeFalse();
    });
  });

  describe('scaleLabel', () => {
    it('retorna label para SCORE_0_20', () => {
      expect(component.scaleLabel(EvaluationScale.SCORE_0_20)).toBeDefined();
    });
  });

  describe('statusLabel', () => {
    it('retorna "Cerrada" para CLOSED', () => {
      expect(component.statusLabel(EvaluationStatus.CLOSED)).toBe('Cerrada');
    });
  });

  describe('shorten', () => {
    it('acorta UUID largo', () => {
      expect(component.shorten('a3f7e2c8-1234-4abc-9999-aaaaaaaaaaaa').length).toBeLessThan(15);
    });
  });

  describe('formatRecorded', () => {
    it('retorna — para null', () => {
      expect(component.formatRecorded(null)).toBe('—');
    });

    it('formatea fecha', () => {
      const formatted = component.formatRecorded(new Date('2026-06-11T10:30:00'));
      expect(formatted).toBeTruthy();
    });
  });

  describe('busyRow', () => {
    it('retorna false si no está en set', () => {
      expect(component.busyRow('gr1')).toBeFalse();
    });
  });

  describe('goBack', () => {
    it('navega al detalle de evaluation', () => {
      const routerSpy = TestBed.inject(Router);
      component.goBack();
      expect(routerSpy.navigate).toHaveBeenCalled();
    });
  });

  describe('Inline editing', () => {
    it('startEditValue inicia edición inline', () => {
      component.startEditValue({ publicUuid: 'gr1', score: 15 } as any);
      expect(component.editState()).toBeTruthy();
      expect(component.editState()!.field).toBe('score');
    });

    it('cancelEdit limpia estado', () => {
      component.startEditValue({ publicUuid: 'gr1', score: 15 } as any);
      component.cancelEdit();
      expect(component.editState()).toBeNull();
    });
  });
});
