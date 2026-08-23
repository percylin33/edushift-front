export interface MeGrade {
  readonly publicUuid: string;
  readonly evaluationPublicUuid: string | null;
  readonly evaluationName: string | null;
  readonly sectionName: string | null;
  readonly courseName: string | null;
  readonly score: number | null;
  readonly maxScore: number | null;
  readonly literal: string | null;
  readonly comments: string | null;
  readonly scheduledDate: string | null;
  readonly recordedAt: string | null;
}
