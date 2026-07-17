export interface PlatformPlan {
  publicUuid: string;
  name: string;
  code: string;
  description?: string;
  pricePerStudentCents: number;
  maxStudents?: number;
  features: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanRequest {
  name: string;
  code: string;
  description?: string;
  pricePerStudentCents: number;
  maxStudents?: number;
  features: string[];
}

export interface UpdatePlanRequest {
  name?: string;
  description?: string;
  pricePerStudentCents?: number;
  maxStudents?: number;
  features?: string[];
  isActive?: boolean;
}
