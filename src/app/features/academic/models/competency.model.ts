// =============================================================================
// Raw wire shapes — espejo 1:1 del backend (BE-5A.2)
// =============================================================================

export type CompetencyOrigin = 'MINEDU' | 'INSTITUTIONAL' | 'TEACHER';
export type CurriculumSourceContentStatus =
  | 'MINEDU_SUMMARY'
  | 'MINEDU_TRANSCRIPTION'
  | 'INSTITUTIONAL_ADAPTATION'
  | 'LEGACY_UNVERIFIED';

export interface CompetencyListItemRaw {
  publicUuid: string;
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  capacityCount: number;
  origin?: CompetencyOrigin;
  createdBy?: string | null;
  sourceCatalogVersion?: string | null;
  sourceCatalogCode?: string | null;
  sourceLevelCode?: string | null;
  sourceCycleCodes?: string | null;
  sourceContentStatus?: CurriculumSourceContentStatus | null;
}

export interface CompetencyCourseRefRaw {
  publicUuid: string;
  code: string;
  name: string;
}

export interface CompetencyCapacityRefRaw {
  publicUuid: string;
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  sourceCatalogVersion?: string | null;
  sourceCatalogCode?: string | null;
  sourceContentStatus?: CurriculumSourceContentStatus | null;
}

export interface CompetencyResponseRaw {
  publicUuid: string;
  course: CompetencyCourseRefRaw;
  code: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  capacities: CompetencyCapacityRefRaw[];
  createdAt: string | null;
  updatedAt: string | null;
  origin?: CompetencyOrigin;
  createdBy?: string | null;
  sourceCatalogVersion?: string | null;
  sourceCatalogCode?: string | null;
  sourceLevelCode?: string | null;
  sourceCycleCodes?: string | null;
  sourceContentStatus?: CurriculumSourceContentStatus | null;
}

export interface CapacityCompetencyRefRaw {
  publicUuid: string;
  code: string;
  name: string;
  course: CompetencyCourseRefRaw;
}

export interface CapacityResponseRaw {
  publicUuid: string;
  competency: CapacityCompetencyRefRaw;
  code: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  sourceCatalogVersion?: string | null;
  sourceCatalogCode?: string | null;
  sourceContentStatus?: CurriculumSourceContentStatus | null;
}

export interface SeedCompetenciesResponse {
  seeded: boolean;
  unsupportedCourseCode: boolean;
  courseCode: string;
  competenciesCreated: number;
  capacitiesCreated: number;
}

// =============================================================================
// UI shapes
// =============================================================================

export interface CompetencyRow {
  publicUuid: string;
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  capacityCount: number;
  capacities: CapacityRow[];
  origin: CompetencyOrigin;
  createdBy?: string | null;
  sourceCatalogVersion?: string | null;
  sourceCatalogCode?: string | null;
  sourceLevelCode?: string | null;
  sourceCycleCodes?: string | null;
  sourceContentStatus?: CurriculumSourceContentStatus | null;
}

export interface CompetencyDetail extends CompetencyRow {
  course: CompetencyCourseRefRaw;
  description?: string;
  capacities: CapacityRow[];
  createdAt?: Date;
  updatedAt?: Date;
  sourceCatalogVersion?: string | null;
  sourceCatalogCode?: string | null;
  sourceContentStatus?: CurriculumSourceContentStatus | null;
}

export interface CapacityRow {
  publicUuid: string;
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  description?: string;
  sourceCatalogVersion?: string | null;
  sourceCatalogCode?: string | null;
  sourceContentStatus?: CurriculumSourceContentStatus | null;
  competency: {
    publicUuid: string;
    code: string;
    name: string;
    course: CompetencyCourseRefRaw;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export type CapacityDetail = CapacityRow;

// =============================================================================
// Request shapes
// =============================================================================

export interface CreateCompetencyCapacityRequest {
  code?: string;
  name: string;
}

export interface CreateCompetencyRequest {
  code?: string;
  name: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
  capacities?: CreateCompetencyCapacityRequest[];
}

export interface UpdateCompetencyRequest {
  code?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface CompetencyReorderItem {
  publicUuid: string;
  displayOrder: number;
}

export interface CompetencyReorderRequest {
  items: CompetencyReorderItem[];
}

export interface CreateCapacityRequest {
  code: string;
  name: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpdateCapacityRequest {
  code?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface CapacityReorderItem {
  publicUuid: string;
  displayOrder: number;
}

export interface CapacityReorderRequest {
  items: CapacityReorderItem[];
}

// =============================================================================
// Validation helpers
// =============================================================================

export const COMPETENCY_CODE_MAX_LENGTH = 40;
export const COMPETENCY_NAME_MAX_LENGTH = 300;
export const COMPETENCY_DESCRIPTION_MAX_LENGTH = 4000;
