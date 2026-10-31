export interface MeGradesPeriod {
  readonly publicUuid: string;
  readonly name: string;
  readonly current: boolean;
}

export interface MeGradeCategorySummary {
  readonly publicUuid: string;
  readonly name: string;
  readonly weight: number | null;
  readonly average: number | null;
  readonly literalAverage: string | null;
}

export interface MeGradeCourseSummary {
  readonly assignmentPublicUuid: string;
  readonly coursePublicUuid: string | null;
  readonly courseName: string | null;
  readonly sectionName: string | null;
  readonly teacherName: string | null;
  readonly scale: string | null;
  readonly average: number | null;
  readonly literalAverage: string | null;
  readonly categories: readonly MeGradeCategorySummary[];
}

export interface MeGradeSummaryItem {
  readonly publicUuid: string;
  readonly assignmentPublicUuid: string;
  readonly coursePublicUuid: string | null;
  readonly courseName: string | null;
  readonly sectionName: string | null;
  readonly evaluationName: string | null;
  readonly kind: string | null;
  readonly weight: number | null;
  readonly scale: string | null;
  readonly score: number | null;
  readonly maxScore: number | null;
  readonly literal: string | null;
  readonly comments: string | null;
  readonly teacherName: string | null;
  readonly periodPublicUuid: string | null;
  readonly scheduledDate: string | null;
  readonly recordedAt: string | null;
  readonly countsTowardAverage: boolean;
  readonly source: 'REGISTER' | 'TASK';
  readonly role: 'OFFICIAL' | 'EVIDENCE' | 'CLASSWORK';
}

export interface MeGradesSummary {
  readonly period: MeGradesPeriod | null;
  readonly overallAverage: number | null;
  readonly courseCount: number;
  readonly gradedCourseCount: number;
  readonly gradedCount: number;
  readonly courses: readonly MeGradeCourseSummary[];
  readonly items: readonly MeGradeSummaryItem[];
}
