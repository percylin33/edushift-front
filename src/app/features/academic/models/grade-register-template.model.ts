/**
 * Models del registro formal de notas — plantillas (F1 + planilla slots).
 *
 * Espejo de DTOs Java en {@code evaluations.graderegister.dto}.
 */

export type GradeRegisterTemplateScope = 'TENANT' | 'COURSE';

/** OPEN = docente crea columnas; SERIES = S1..Sn; SINGLE = una casilla. */
export type GradeCategoryColumnMode = 'OPEN' | 'SERIES' | 'SINGLE';

/** Recommended catalog levels (Peru EBR tags; not SIAGIE). */
export type GradeRegisterRecommendedLevel = 'INICIAL' | 'PRIMARIA' | 'SECUNDARIA';

export interface GradeRegisterTemplateListItem {
  publicUuid: string;
  name: string;
  description: string | null;
  scope: GradeRegisterTemplateScope;
  system: boolean;
  isDefault: boolean;
  catalogCode: string | null;
  academicYearPublicUuid: string | null;
  categoryCount: number;
  recommendedLevels?: GradeRegisterRecommendedLevel[] | string[] | null;
}

export interface GradeCategory {
  publicUuid: string;
  name: string;
  colorToken: string | null;
  sortOrder: number;
  weight: number;
  contributesToAverage: boolean;
  allowsTeacherColumns: boolean;
  columnMode: GradeCategoryColumnMode;
  slotCount: number | null;
  slotLabelPrefix: string | null;
  slotLabels: string[] | null;
}

export interface GradeRegisterTemplate {
  publicUuid: string;
  name: string;
  description: string | null;
  scope: GradeRegisterTemplateScope;
  system: boolean;
  isDefault: boolean;
  catalogCode: string | null;
  academicYearPublicUuid: string | null;
  academicYearName: string | null;
  coursePublicUuid: string | null;
  courseName: string | null;
  sourceTemplatePublicUuid: string | null;
  categories: GradeCategory[];
  recommendedLevels?: GradeRegisterRecommendedLevel[] | string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdoptGradeRegisterTemplateRequest {
  academicYearPublicUuid: string;
  scope: GradeRegisterTemplateScope;
  coursePublicUuid?: string | null;
  setAsDefault?: boolean;
  /** Soft-delete current TENANT default before adopting (blocked if in use). */
  replaceActive?: boolean;
}

export interface UpdateGradeCategoryRequest {
  name?: string;
  colorToken?: string | null;
  sortOrder?: number;
  weight?: number;
  contributesToAverage?: boolean;
  allowsTeacherColumns?: boolean;
  columnMode?: GradeCategoryColumnMode;
  slotCount?: number | null;
  slotLabelPrefix?: string | null;
  slotLabels?: string[] | null;
}

export interface CreateGradeCategoryRequest {
  name: string;
  colorToken?: string | null;
  sortOrder: number;
  weight: number;
  contributesToAverage?: boolean;
  allowsTeacherColumns?: boolean;
  columnMode?: GradeCategoryColumnMode;
  slotCount?: number | null;
  slotLabelPrefix?: string | null;
  slotLabels?: string[] | null;
}

/** Raw over-the-wire (weight may arrive as string from BigDecimal). */
export interface GradeCategoryRaw {
  publicUuid: string;
  name: string;
  colorToken: string | null;
  sortOrder: number;
  weight: string | number;
  contributesToAverage: boolean;
  allowsTeacherColumns: boolean;
  columnMode?: GradeCategoryColumnMode | null;
  slotCount?: number | null;
  slotLabelPrefix?: string | null;
  slotLabels?: string[] | null;
}

export interface GradeRegisterTemplateRaw {
  publicUuid: string;
  name: string;
  description: string | null;
  scope: GradeRegisterTemplateScope;
  system: boolean;
  isDefault: boolean;
  catalogCode: string | null;
  academicYearPublicUuid: string | null;
  academicYearName: string | null;
  coursePublicUuid: string | null;
  courseName: string | null;
  sourceTemplatePublicUuid: string | null;
  categories: GradeCategoryRaw[];
  recommendedLevels?: string[] | null;
  createdAt: string;
  updatedAt: string;
}

function parseWeight(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function resolveSlotLabels(c: Pick<
  GradeCategory,
  'columnMode' | 'slotCount' | 'slotLabelPrefix' | 'slotLabels' | 'name'
>): string[] {
  const mode = c.columnMode ?? 'OPEN';
  if (mode === 'OPEN') return [];
  if (mode === 'SINGLE') {
    const custom = c.slotLabels?.find((s) => !!s?.trim());
    return [custom?.trim() || c.name || 'Nota'];
  }
  const cleaned = (c.slotLabels ?? []).map((s) => s.trim()).filter(Boolean);
  if (cleaned.length > 0) return cleaned;
  const n = Math.max(0, Math.min(c.slotCount ?? 0, 40));
  const prefix = (c.slotLabelPrefix || 'S').trim() || 'S';
  return Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
}

export function toGradeCategory(raw: GradeCategoryRaw): GradeCategory {
  return {
    publicUuid: raw.publicUuid,
    name: raw.name,
    colorToken: raw.colorToken,
    sortOrder: raw.sortOrder ?? 0,
    weight: parseWeight(raw.weight),
    contributesToAverage: !!raw.contributesToAverage,
    allowsTeacherColumns: raw.allowsTeacherColumns !== false,
    columnMode: raw.columnMode ?? 'OPEN',
    slotCount: raw.slotCount ?? null,
    slotLabelPrefix: raw.slotLabelPrefix ?? 'S',
    slotLabels: raw.slotLabels ?? null,
  };
}

export function toGradeRegisterTemplate(raw: GradeRegisterTemplateRaw): GradeRegisterTemplate {
  return {
    publicUuid: raw.publicUuid,
    name: raw.name,
    description: raw.description,
    scope: raw.scope,
    system: !!raw.system,
    isDefault: !!raw.isDefault,
    catalogCode: raw.catalogCode,
    academicYearPublicUuid: raw.academicYearPublicUuid,
    academicYearName: raw.academicYearName,
    coursePublicUuid: raw.coursePublicUuid,
    courseName: raw.courseName,
    sourceTemplatePublicUuid: raw.sourceTemplatePublicUuid,
    categories: (raw.categories ?? []).map(toGradeCategory),
    recommendedLevels: raw.recommendedLevels ?? [],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}
