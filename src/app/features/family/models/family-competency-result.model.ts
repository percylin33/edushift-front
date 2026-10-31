export interface FamilyCompetencyResultRaw {
  publicUuid: string;
  evaluationName: string;
  evaluationDate: string | null;
  courseName: string;
  sectionName: string;
  competencyCode: string | null;
  competencyName: string;
  achievementLevel: string;
  evidenceSummary: string | null;
  descriptiveConclusion: string | null;
  recordedAt: string | null;
}

export interface FamilyCompetencyResult {
  publicUuid: string;
  evaluationName: string;
  evaluationDate?: Date;
  courseName: string;
  sectionName: string;
  competencyCode?: string;
  competencyName: string;
  achievementLevel: string;
  evidenceSummary?: string;
  descriptiveConclusion?: string;
  recordedAt?: Date;
}

export function toFamilyCompetencyResult(raw: FamilyCompetencyResultRaw): FamilyCompetencyResult {
  return {
    publicUuid: raw.publicUuid,
    evaluationName: raw.evaluationName,
    evaluationDate: raw.evaluationDate ? new Date(raw.evaluationDate) : undefined,
    courseName: raw.courseName,
    sectionName: raw.sectionName,
    competencyCode: raw.competencyCode ?? undefined,
    competencyName: raw.competencyName,
    achievementLevel: raw.achievementLevel,
    evidenceSummary: raw.evidenceSummary ?? undefined,
    descriptiveConclusion: raw.descriptiveConclusion ?? undefined,
    recordedAt: raw.recordedAt ? new Date(raw.recordedAt) : undefined,
  };
}
