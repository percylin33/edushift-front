export interface PlatformPlan {
  publicUuid: string;
  name: string;
  code: string;
  description?: string;
  pricePerStudentCents: number;
  maxStudents?: number;
  maxTeachers?: number;
  maxStorageMb?: number;
  sortOrder: number;
  features: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlanAnalytics {
  planId: string;
  activeInstitutions: number;
  enrolledStudents: number;
  projectedMrrCents: number;
  aiTokensUsedThisMonth: number;
  aiTokenQuotaThisMonth: number;
}

export interface PlanAiPolicy {
  planId: string;
  dailyRequestLimit: number;
  monthlyTokenLimit: number;
  tutorMessagesPerStudentDay: number;
  institutionalDocumentLimit: number;
  institutionalTextBytesLimit: number;
}

export interface CreatePlanRequest {
  name: string;
  code: string;
  description?: string;
  pricePerStudentCents: number;
  maxStudents?: number;
  maxTeachers?: number;
  maxStorageMb: number;
  sortOrder: number;
  features: string[];
}

export interface UpdatePlanRequest {
  name?: string;
  description?: string;
  pricePerStudentCents?: number;
  maxStudents?: number;
  maxTeachers?: number;
  maxStorageMb?: number;
  sortOrder?: number;
  features?: string[];
  isActive?: boolean;
  clearMaxStudents?: boolean;
  clearMaxTeachers?: boolean;
}
