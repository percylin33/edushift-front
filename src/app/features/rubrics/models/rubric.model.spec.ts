import {
  toRubricDetail,
  toRubricRow,
  toCriterionView,
  toLevelView,
  totalCriteriaWeight,
  isWeightSumValid,
  isCriterionKeyValid,
  uniqueCriterionKeys,
  uniqueLevelCodes,
  RubricResponseRaw,
  RubricListItemRaw,
  RubricDetail,
  RubricRow,
  CRITERION_KEY_PATTERN,
  WEIGHT_SUM_TARGET,
} from './rubric.model';

describe('toRubricDetail', () => {
  it('convierte raw a detail correctamente', () => {
    const raw: RubricResponseRaw = {
      publicUuid: 'r1',
      name: 'Rúbrica Test',
      description: 'Desc',
      criteria: [
        {
          key: 'c1',
          name: 'Criterio 1',
          description: null,
          weight: '50.00',
          descriptors: [{ level: 'AD', text: 'Excelente' }],
        },
      ],
      levels: [{ code: 'AD', name: 'Logro destacado', order: 0 }],
      isSystem: false,
      parentRubricPublicUuid: null,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    const detail = toRubricDetail(raw);
    expect(detail.name).toBe('Rúbrica Test');
    expect(detail.criteria.length).toBe(1);
    expect(detail.criteria[0].weight).toBe(50);
    expect(detail.levels[0].code).toBe('AD');
    expect(detail.isSystem).toBeFalse();
    expect(detail.createdAt).toEqual(jasmine.any(Date));
  });
});

describe('toRubricRow', () => {
  it('convierte raw a row', () => {
    const raw: RubricListItemRaw = {
      publicUuid: 'r1',
      name: 'Row Test',
      description: null,
      isSystem: true,
      parentRubricPublicUuid: null,
      criterionCount: 3,
      criterionSummary: ['50% C1', '50% C2'],
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    const row = toRubricRow(raw);
    expect(row.name).toBe('Row Test');
    expect(row.isSystem).toBeTrue();
    expect(row.criterionCount).toBe(3);
  });
});

describe('toCriterionView', () => {
  it('convierte raw criterion a view', () => {
    const view = toCriterionView({
      key: 'org',
      name: 'Organización',
      description: null,
      weight: '30',
      descriptors: [],
    });
    expect(view.weight).toBe(30);
    expect(view.description).toBeUndefined();
  });
});

describe('toLevelView', () => {
  it('convierte raw level a view', () => {
    const view = toLevelView({ code: 'AD', name: 'Destacado', order: 0 });
    expect(view.order).toBe(0);
  });

  it('maneja order null', () => {
    const view = toLevelView({ code: 'B', name: 'En proceso', order: null });
    expect(view.order).toBeUndefined();
  });
});

describe('totalCriteriaWeight', () => {
  it('suma pesos correctamente', () => {
    expect(totalCriteriaWeight([{ weight: 30 }, { weight: 70 }])).toBe(100);
  });

  it('retorna 0 para array vacío', () => {
    expect(totalCriteriaWeight([])).toBe(0);
  });
});

describe('isWeightSumValid', () => {
  it('retorna true si suma es 100', () => {
    expect(isWeightSumValid([{ weight: 50 }, { weight: 50 }])).toBeTrue();
  });

  it('retorna false si suma no es 100', () => {
    expect(isWeightSumValid([{ weight: 30 }, { weight: 30 }])).toBeFalse();
  });
});

describe('isCriterionKeyValid', () => {
  it('acepta snake_case válido', () => {
    expect(isCriterionKeyValid('organizacion_texto')).toBeTrue();
  });

  it('rechaza mayúsculas', () => {
    expect(isCriterionKeyValid('Organizacion')).toBeFalse();
  });

  it('rechaza espacios', () => {
    expect(isCriterionKeyValid('org texto')).toBeFalse();
  });
});

describe('uniqueCriterionKeys', () => {
  it('retorna true si todas son únicas', () => {
    expect(uniqueCriterionKeys([{ key: 'a' }, { key: 'b' }])).toBeTrue();
  });

  it('retorna false si hay duplicados', () => {
    expect(uniqueCriterionKeys([{ key: 'a' }, { key: 'a' }])).toBeFalse();
  });
});

describe('uniqueLevelCodes', () => {
  it('retorna true si todos son únicos', () => {
    expect(uniqueLevelCodes([{ code: 'AD' }, { code: 'A' }])).toBeTrue();
  });

  it('retorna false si hay duplicados', () => {
    expect(uniqueLevelCodes([{ code: 'AD' }, { code: 'AD' }])).toBeFalse();
  });
});

describe('CRITERION_KEY_PATTERN', () => {
  it('valida snake_case', () => {
    expect(CRITERION_KEY_PATTERN.test('analisis_datos_2026')).toBeTrue();
    expect(CRITERION_KEY_PATTERN.test('Invalid-Key')).toBeFalse();
  });
});

describe('WEIGHT_SUM_TARGET', () => {
  it('es 100', () => {
    expect(WEIGHT_SUM_TARGET).toBe(100);
  });
});
