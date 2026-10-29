export interface CriterionResult {
  criterionName: string;
  achievementLevel: string;
  evidence: string | null;
  feedback: string | null;
}

export interface StudentCompetencyResult {
  publicUuid: string;
  competencyPublicUuid: string;
  competencyCode: string;
  competencyName: string;
  achievementLevel: string;
  evidenceSummary: string | null;
  descriptiveConclusion: string | null;
  criteriaResults: CriterionResult[];
  revision: number;
  recordedAt: string;
  recordedByUserId: string;
}

export interface StudentCompetencyResultRevision {
  revision: number;
  snapshot: {
    achievementLevel?: string;
    evidenceSummary?: string | null;
    descriptiveConclusion?: string | null;
    criteriaResults?: CriterionResult[];
    isActive?: boolean;
  };
  changedByUserId: string;
  changedAt: string;
}

export interface CompetencyResultInput {
  competencyPublicUuid: string;
  achievementLevel: string;
  evidenceSummary: string | null;
  descriptiveConclusion: string | null;
  criteriaResults: CriterionResult[];
}

export interface UpsertStudentCompetencyResultsRequest {
  results: CompetencyResultInput[];
}

export type CompetencyResultForm = CompetencyResultInput;
