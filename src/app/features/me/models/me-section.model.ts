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
}

export interface MeMaterialItem {
  readonly publicUuid: string;
  readonly title: string;
  readonly kind: string;
  readonly ownerPublicUuid: string | null;
  readonly createdAt: string | null;
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
}
