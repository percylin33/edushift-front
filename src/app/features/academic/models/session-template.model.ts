export type SessionTemplateFamily =
  | 'STANDARD'
  | 'COMMUNICATION'
  | 'MATH'
  | 'CUSTOM';

export type SessionTemplateOrigin = 'SYSTEM' | 'TENANT';

export interface SessionTemplatePhasePreview {
  name: string;
  durationMin: number | null;
  description: string | null;
}

export interface SessionTemplateListItem {
  publicUuid: string;
  templateKey: string;
  name: string;
  description: string | null;
  family: SessionTemplateFamily;
  familyLabel: string;
  origin: SessionTemplateOrigin;
  isSystem: boolean;
  isDefault: boolean;
  adopted: boolean;
  canAdopt: boolean;
  canEdit: boolean;
  phasesPreview: SessionTemplatePhasePreview[];
}

export interface SessionTemplateGroup {
  family: SessionTemplateFamily;
  labelEs: string;
  templates: SessionTemplateListItem[];
}

export interface SessionTemplatesOrganized {
  groups: SessionTemplateGroup[];
}

export interface SessionTemplateDetail {
  publicUuid: string;
  templateKey: string;
  name: string;
  description: string | null;
  schema: Record<string, unknown> | null;
  isSystem: boolean;
  family: SessionTemplateFamily;
  sourceTemplateUuid: string | null;
  isDefault: boolean;
  createdAt: string | null;
}

export interface CreateSessionTemplateRequest {
  templateKey: string;
  name: string;
  description?: string | null;
  schema?: Record<string, unknown> | null;
}

export interface UpdateSessionTemplateRequest {
  name?: string | null;
  description?: string | null;
  schema?: Record<string, unknown> | null;
  isDefault?: boolean | null;
}

export interface AdoptSessionTemplateRequest {
  setAsDefault?: boolean;
}

export const SESSION_TEMPLATE_FAMILY_LABELS: Record<SessionTemplateFamily, string> = {
  STANDARD: 'Estándar MINEDU',
  COMMUNICATION: 'Comunicación / Lectura',
  MATH: 'Matemática',
  CUSTOM: 'Propias del colegio',
};
