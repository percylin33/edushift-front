export interface FamilyGradeItemRaw {
  publicUuid: string;
  evaluationPublicUuid: string | null;
  evaluationName: string | null;
  sectionName: string | null;
  courseName: string | null;
  score: string | null;
  maxScore: string | null;
  literal: string | null;
  comments: string | null;
  scheduledDate: string | null;
  recordedAt: string | null;
}

export interface FamilyGradeItem {
  publicUuid: string;
  evaluationPublicUuid?: string;
  evaluationName?: string;
  sectionName?: string;
  courseName?: string;
  score: number | null;
  maxScore: number | null;
  literal?: string;
  comments?: string;
  scheduledDate?: Date;
  recordedAt?: Date;
}

function parseDecimal(value: string | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toFamilyGradeItem(raw: FamilyGradeItemRaw): FamilyGradeItem {
  return {
    publicUuid: raw.publicUuid,
    evaluationPublicUuid: raw.evaluationPublicUuid ?? undefined,
    evaluationName: raw.evaluationName ?? undefined,
    sectionName: raw.sectionName ?? undefined,
    courseName: raw.courseName ?? undefined,
    score: parseDecimal(raw.score),
    maxScore: parseDecimal(raw.maxScore),
    literal: raw.literal ?? undefined,
    comments: raw.comments ?? undefined,
    scheduledDate: raw.scheduledDate ? new Date(raw.scheduledDate) : undefined,
    recordedAt: raw.recordedAt ? new Date(raw.recordedAt) : undefined,
  };
}
