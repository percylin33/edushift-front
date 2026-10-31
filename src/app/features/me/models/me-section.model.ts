export interface MeSection {
  readonly publicUuid: string;
  readonly name: string;
  readonly gradeName: string | null;
  readonly gradeLevelName: string | null;
  readonly academicYearLabel: string | null;
  readonly teacherName: string | null;
  readonly courseName: string | null;
  readonly materialCount: number;
  readonly taskCount: number;
  readonly quizCount: number;
  readonly enrolledAt: string | null;
  /** Present when the card maps to one TeacherAssignment (V105). */
  readonly teacherAssignmentPublicUuid: string | null;
  /** Academic period label for the current bimester/trimester (when filtered). */
  readonly periodLabel: string | null;
}

export interface MeMaterialItem {
  readonly publicUuid: string;
  readonly title: string;
  readonly kind: string;
  readonly ownerPublicUuid: string | null;
  readonly createdAt: string | null;
  readonly filePublicUuid: string | null;
  readonly filename: string | null;
  readonly externalUrl: string | null;
}

export interface MeTaskItem {
  readonly publicUuid: string;
  readonly title: string;
  readonly dueAt: string | null;
  readonly overdue: boolean;
  readonly ownerPublicUuid: string | null;
  readonly hasAttachment: boolean;
}

export interface MeQuizItem {
  readonly publicUuid: string;
  readonly title: string;
  readonly status: string;
  readonly dueAt: string | null;
  readonly maxScore: number | null;
  readonly timeLimitMinutes: number | null;
  readonly attemptsAllowed: number | null;
  readonly ownerPublicUuid: string | null;
  readonly questionCount: number;
}

export interface MeSectionDetail {
  readonly publicUuid: string;
  readonly name: string;
  readonly gradeName: string | null;
  readonly gradeLevelName: string | null;
  readonly academicYearLabel: string | null;
  readonly teacherName: string | null;
  readonly courseName: string | null;
  readonly materials: readonly MeMaterialItem[];
  readonly tasks: readonly MeTaskItem[];
  readonly quizzes: readonly MeQuizItem[];
  readonly teacherAssignmentPublicUuid: string | null;
  readonly periodLabel: string | null;
}

export interface MeSectionPeriod {
  readonly publicUuid: string;
  readonly name: string;
  readonly ordinal: number;
  readonly current: boolean;
}

export interface MeSectionPeriod {
  readonly publicUuid: string;
  readonly name: string;
  readonly ordinal: number;
  readonly current: boolean;
}
