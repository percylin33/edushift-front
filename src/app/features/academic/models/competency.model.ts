// =============================================================================
// Raw wire shapes — espejo 1:1 del backend (BE-5A.2)
// =============================================================================

export interface CompetencyListItemRaw {
  publicUuid: string;
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  capacityCount: number;
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
}

export interface CompetencyDetail extends CompetencyRow {
  course: CompetencyCourseRefRaw;
  description?: string;
  capacities: CapacityRow[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CapacityRow {
  publicUuid: string;
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  description?: string;
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

export interface CreateCompetencyRequest {
  code: string;
  name: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
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
