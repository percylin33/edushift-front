import {
  SCORE_MIN,
  SCORE_MAX,
  COMMENTS_MAX_LENGTH,
  BULK_MAX_ROWS,
  ALLOWED_LITERALS_BY_SCALE,
  toGradeRecordRow,
  toGradeRecordDetail,
  toBulkSummary,
  validateGradeShape,
  areGradesEditable,
  GradeRecordListItemRaw,
  GradeRecordResponseRaw,
  BulkGradeRecordResponseRaw,
} from './grade-record.model';
import { EvaluationScale, EvaluationStatus } from '../../evaluations/models';

describe('toGradeRecordRow', () => {
  it('convierte raw a row correctamente', () => {
    const raw: GradeRecordListItemRaw = {
      publicUuid: 'gr1',
      studentPublicUuid: 'stu1',
      studentFirstName: 'Juan',
      studentLastName: 'Pérez',
      studentSecondLastName: null,
      score: '15.5',
      literal: null,
      comments: 'Buen trabajo',
      recordedAt: '2026-01-15T10:00:00Z',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-15T10:00:00Z',
    };
    const row = toGradeRecordRow(raw);
    expect(row.studentFullName).toContain('Pérez');
    expect(row.studentFullName).toContain('Juan');
    expect(row.score).toBe(15.5);
    expect(row.recordedAt).toEqual(jasmine.any(Date));
  });
});

describe('toGradeRecordDetail', () => {
  it('convierte response raw a detail', () => {
    const raw: GradeRecordResponseRaw = {
      publicUuid: 'gr1',
      evaluation: {
        publicUuid: 'e1',
        name: 'Examen',
        scale: EvaluationScale.SCORE_0_20,
        status: EvaluationStatus.DRAFT,
      },
      student: { publicUuid: 'stu1', firstName: 'Ana', lastName: 'López', secondLastName: null },
      score: '18',
      literal: null,
      comments: null,
      recordedAt: null,
      recordedByUserId: null,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    const detail = toGradeRecordDetail(raw);
    expect(detail.evaluation.name).toBe('Examen');
    expect(detail.score).toBe(18);
  });
});

describe('toBulkSummary', () => {
  it('convierte bulk response', () => {
    const raw: BulkGradeRecordResponseRaw = {
      requested: 2,
      created: 1,
      updated: 1,
      records: [],
    };
    const summary = toBulkSummary(raw);
    expect(summary.requested).toBe(2);
    expect(summary.created).toBe(1);
  });
});

describe('validateGradeShape', () => {
  it('acepta score válido para SCORE_0_20', () => {
    expect(validateGradeShape(EvaluationScale.SCORE_0_20, { score: 15 })).toBeNull();
  });

  it('rechaza score fuera de rango', () => {
    expect(validateGradeShape(EvaluationScale.SCORE_0_20, { score: 25 })).toContain('entre');
  });

  it('rechaza literal en SCORE_0_20', () => {
    expect(validateGradeShape(EvaluationScale.SCORE_0_20, { score: 15, literal: 'AD' })).toContain(
      'no admite literal',
    );
  });

  it('rechaza score en LITERAL_AD', () => {
    expect(validateGradeShape(EvaluationScale.LITERAL_AD, { score: 15 })).toContain(
      'no admite nota numérica',
    );
  });

  it('acepta literal válido en LITERAL_AD', () => {
    expect(validateGradeShape(EvaluationScale.LITERAL_AD, { literal: 'AD' })).toBeNull();
  });

  it('rechaza literal inválido', () => {
    expect(validateGradeShape(EvaluationScale.LITERAL_A_B_C_D, { literal: 'Z' })).toContain(
      'inválido',
    );
  });

  it('rechaza si no hay score ni literal', () => {
    expect(validateGradeShape(EvaluationScale.SCORE_0_20, {})).toContain('Debes ingresar');
  });
});

describe('areGradesEditable', () => {
  it('retorna true para DRAFT', () => {
    expect(areGradesEditable(EvaluationStatus.DRAFT)).toBeTrue();
  });

  it('retorna true para PUBLISHED', () => {
    expect(areGradesEditable(EvaluationStatus.PUBLISHED)).toBeTrue();
  });

  it('retorna false para CLOSED', () => {
    expect(areGradesEditable(EvaluationStatus.CLOSED)).toBeFalse();
  });
});

describe('constantes', () => {
  it('SCORE_MIN es 0', () => {
    expect(SCORE_MIN).toBe(0);
  });
  it('SCORE_MAX es 20', () => {
    expect(SCORE_MAX).toBe(20);
  });
  it('COMMENTS_MAX_LENGTH es 1000', () => {
    expect(COMMENTS_MAX_LENGTH).toBe(1000);
  });
  it('BULK_MAX_ROWS es 200', () => {
    expect(BULK_MAX_ROWS).toBe(200);
  });
  it('ALLOWED_LITERALS_BY_SCALE tiene keys para todas las scales', () => {
    expect(ALLOWED_LITERALS_BY_SCALE[EvaluationScale.SCORE_0_20]).toEqual([]);
    expect(ALLOWED_LITERALS_BY_SCALE[EvaluationScale.LITERAL_AD]).toContain('AD');
  });
});
