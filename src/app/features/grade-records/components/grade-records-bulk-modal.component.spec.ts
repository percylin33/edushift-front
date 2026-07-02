import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GradeRecordsBulkModalComponent } from './grade-records-bulk-modal.component';
import { EvaluationScale } from '@features/evaluations/models';

describe('GradeRecordsBulkModalComponent', () => {
  let component: GradeRecordsBulkModalComponent;
  let fixture: ComponentFixture<GradeRecordsBulkModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GradeRecordsBulkModalComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(GradeRecordsBulkModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('scale', EvaluationScale.SCORE_0_20);
    fixture.componentRef.setInput('saving', false);
    fixture.componentRef.setInput('errorBanner', null);
    fixture.componentRef.setInput('lastSummary', null);
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  describe('valueColumnLabel', () => {
    it('retorna "nota" para SCORE_0_20', () => {
      expect(component.valueColumnLabel()).toBe('nota');
    });

    it('retorna "literal" para escala literal', () => {
      fixture.componentRef.setInput('scale', EvaluationScale.LITERAL_AD);
      fixture.detectChanges();
      expect(component.valueColumnLabel()).toBe('literal');
    });
  });

  describe('parsed', () => {
    it('parsea CSV válido', () => {
      component.csv.set('a3f7e2c8-1234-4abc-9999-aaaaaaaaaaaa, 18.5, Excelente');
      const parsed = component.parsed();
      expect(parsed.length).toBe(1);
      expect(parsed[0].error).toBeNull();
      expect(parsed[0].payload?.score).toBe(18.5);
    });

    it('ignora líneas vacías y comentarios', () => {
      component.csv.set('\n# comentario\n\na3f7e2c8-1234-4abc-9999-aaaaaaaaaaaa, 15\n');
      expect(component.parsed().length).toBe(1);
    });

    it('reporta error para UUID inválido', () => {
      component.csv.set('invalido, 15');
      const parsed = component.parsed();
      expect(parsed[0].error).toContain('UUID');
    });

    it('reporta error para nota no numérica', () => {
      component.csv.set('a3f7e2c8-1234-4abc-9999-aaaaaaaaaaaa, abc');
      const parsed = component.parsed();
      expect(parsed[0].error).toContain('numérica');
    });

    it('reporta error para pocas columnas', () => {
      component.csv.set('a3f7e2c8-1234-4abc-9999-aaaaaaaaaaaa');
      const parsed = component.parsed();
      expect(parsed[0].error).toContain('Faltan columnas');
    });

    it('normaliza coma decimal', () => {
      component.csv.set('a3f7e2c8-1234-4abc-9999-aaaaaaaaaaaa, 11,75');
      const parsed = component.parsed();
      expect(parsed[0].payload?.score).toBe(11.75);
    });

    it('parsea escala literal', () => {
      fixture.componentRef.setInput('scale', EvaluationScale.LITERAL_AD);
      fixture.detectChanges();
      component.csv.set('a3f7e2c8-1234-4abc-9999-aaaaaaaaaaaa, AD');
      const parsed = component.parsed();
      expect(parsed[0].payload?.literal).toBe('AD');
    });
  });

  describe('validCount / invalidCount', () => {
    it('calcula conteos correctamente', () => {
      component.csv.set(
        'a3f7e2c8-1234-4abc-9999-aaaaaaaaaaaa, 18\n' +
          'invalido, 15\n' +
          'b3f7e2c8-1234-4abc-9999-bbbbbbbbbbbb, 14',
      );
      expect(component.validCount()).toBe(2);
      expect(component.invalidCount()).toBe(1);
    });
  });

  describe('submit', () => {
    it('emite solo filas válidas', () => {
      const emitSpy = spyOn(component.submitted, 'emit');
      component.csv.set('a3f7e2c8-1234-4abc-9999-aaaaaaaaaaaa, 18');
      component.submit();
      expect(emitSpy).toHaveBeenCalled();
      const payload = emitSpy.calls.mostRecent().args[0];
      expect(payload.length).toBe(1);
    });

    it('no emite si no hay filas válidas', () => {
      const emitSpy = spyOn(component.submitted, 'emit');
      component.submit();
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('placeholder', () => {
    it('retorna placeholder para SCORE_0_20', () => {
      const p = component.placeholder();
      expect(p).toContain('score');
    });

    it('retorna placeholder para LITERAL_AD', () => {
      fixture.componentRef.setInput('scale', EvaluationScale.LITERAL_AD);
      fixture.detectChanges();
      const p = component.placeholder();
      expect(p).toContain('AD');
    });
  });

  describe('shorten', () => {
    it('acorta UUID largo', () => {
      expect(component.shorten('a3f7e2c8-1234-4abc-9999-aaaaaaaaaaaa')).toContain('…');
    });

    it('retorna valor corto sin cambios', () => {
      expect(component.shorten('abc')).toBe('abc');
    });
  });
});
