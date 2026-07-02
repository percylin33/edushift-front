// =============================================================================
// Constraints (espejo del backend Sprint 5B / BE-5B.2)
// =============================================================================

export const RUBRIC_NAME_MAX_LENGTH = 160;
export const RUBRIC_DESCRIPTION_MAX_LENGTH = 2000;
export const CRITERION_KEY_MAX_LENGTH = 64;
export const CRITERION_NAME_MAX_LENGTH = 160;
export const CRITERION_DESCRIPTION_MAX_LENGTH = 1000;
export const LEVEL_CODE_MAX_LENGTH = 64;
export const LEVEL_NAME_MAX_LENGTH = 120;
export const DESCRIPTOR_TEXT_MAX_LENGTH = 2000;

export const CRITERIA_MIN = 1;
export const CRITERIA_MAX = 10;
export const LEVELS_MIN = 2;
export const LEVELS_MAX = 4;
export const WEIGHT_SUM_TARGET = 100;

/**
 * `key` de criterion: snake_case slug. Server-side enforce
 * (`@Pattern("^[a-z0-9_]+$")`), pero validamos cliente-side para feedback
 * inmediato.
 */
export const CRITERION_KEY_PATTERN = /^[a-z0-9_]+$/;

// =============================================================================
// Raw wire shapes
// =============================================================================

export interface DescriptorViewRaw {
  level: string;
  text: string;
}

export interface CriterionViewRaw {
  key: string;
  name: string;
  description: string | null;
  /** Number como string (BigDecimal). */
  weight: string;
  descriptors: DescriptorViewRaw[];
}

export interface LevelViewRaw {
  code: string;
  name: string;
  order: number | null;
}

/** RAW backend {@code RubricResponse}. */
export interface RubricResponseRaw {
  publicUuid: string;
  name: string;
  description: string | null;
  criteria: CriterionViewRaw[];
  levels: LevelViewRaw[];
  isSystem: boolean;
  parentRubricPublicUuid: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** RAW backend {@code RubricListItem}. */
export interface RubricListItemRaw {
  publicUuid: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  parentRubricPublicUuid: string | null;
  criterionCount: number;
  criterionSummary: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// UI shapes
// =============================================================================

export interface DescriptorView {
  level: string;
  text: string;
}

export interface CriterionView {
  key: string;
  name: string;
  description?: string;
  weight: number;
  descriptors: DescriptorView[];
}

export interface LevelView {
  code: string;
  name: string;
  order?: number;
}

/** Detail completo de una rúbrica, post-adapter. */
export interface RubricDetail {
  publicUuid: string;
  name: string;
  description?: string;
  criteria: CriterionView[];
  levels: LevelView[];
  isSystem: boolean;
  parentRubricPublicUuid?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Row del listing — proyección lean. */
export interface RubricRow {
  publicUuid: string;
  name: string;
  description?: string;
  isSystem: boolean;
  parentRubricPublicUuid?: string;
  criterionCount: number;
  criterionSummary: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Request shapes
// =============================================================================

export interface DescriptorInput {
  level: string;
  text: string;
}

export interface CriterionInput {
  /** snake_case slug, único dentro del rubric. */
  key: string;
  name: string;
  description?: string;
  /** [0, 100]; suma de todos los criterios = 100 (server-side enforce). */
  weight: number;
  descriptors: DescriptorInput[];
}

export interface LevelInput {
  code: string;
  name: string;
  order?: number;
}

/**
 * Body de `POST /v1/academic/rubrics` y de `POST /v1/academic/rubrics/{uuid}/fork`.
 *
 * En el caso de fork, todos los campos son opcionales: el server clona
 * el rubric origen y aplica overrides solo donde el caller pasa un valor.
 */
export interface CreateRubricRequest {
  name: string;
  description?: string;
  criteria: CriterionInput[];
  levels: LevelInput[];
}

/** Body de `PUT /v1/academic/rubrics/{uuid}`. Patch parcial. */
export interface UpdateRubricRequest {
  name?: string;
  description?: string;
  criteria?: CriterionInput[];
  levels?: LevelInput[];
}

/** Filtros del `GET /v1/academic/rubrics?systemOnly&isActive&q`. */
export interface RubricFilters {
  /** Si `true`, solo rúbricas del catálogo MINEDU (`isSystem=true`). */
  systemOnly?: boolean;
  isActive?: boolean;
  /** Query case-insensitive sobre name + description. */
  q?: string;
}

// =============================================================================
// Adapters
// =============================================================================

export function toCriterionView(raw: CriterionViewRaw): CriterionView {
  return {
    key: raw.key,
    name: raw.name,
    description: raw.description ?? undefined,
    weight: parseFloat(raw.weight),
    descriptors: raw.descriptors.map((d) => ({ level: d.level, text: d.text })),
  };
}

export function toLevelView(raw: LevelViewRaw): LevelView {
  return {
    code: raw.code,
    name: raw.name,
    order: raw.order ?? undefined,
  };
}

export function toRubricDetail(raw: RubricResponseRaw): RubricDetail {
  return {
    publicUuid: raw.publicUuid,
    name: raw.name,
    description: raw.description ?? undefined,
    criteria: raw.criteria.map(toCriterionView),
    levels: raw.levels.map(toLevelView),
    isSystem: raw.isSystem,
    parentRubricPublicUuid: raw.parentRubricPublicUuid ?? undefined,
    isActive: raw.isActive,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

export function toRubricRow(raw: RubricListItemRaw): RubricRow {
  return {
    publicUuid: raw.publicUuid,
    name: raw.name,
    description: raw.description ?? undefined,
    isSystem: raw.isSystem,
    parentRubricPublicUuid: raw.parentRubricPublicUuid ?? undefined,
    criterionCount: raw.criterionCount,
    criterionSummary: [...raw.criterionSummary],
    isActive: raw.isActive,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

// =============================================================================
// Helpers (validación cliente)
// =============================================================================

export function totalCriteriaWeight(criteria: { weight: number }[]): number {
  return criteria.reduce((acc, c) => acc + (c.weight ?? 0), 0);
}

export function isWeightSumValid(criteria: { weight: number }[]): boolean {
  // Tolerancia ±0.01 para evitar problemas de redondeo IEEE 754.
  return Math.abs(totalCriteriaWeight(criteria) - WEIGHT_SUM_TARGET) < 0.01;
}

export function isCriterionKeyValid(key: string): boolean {
  return CRITERION_KEY_PATTERN.test(key);
}

export function uniqueCriterionKeys(criteria: { key: string }[]): boolean {
  const keys = criteria.map((c) => c.key);
  return new Set(keys).size === keys.length;
}

export function uniqueLevelCodes(levels: { code: string }[]): boolean {
  const codes = levels.map((l) => l.code);
  return new Set(codes).size === codes.length;
}
