import { BaseEntity } from '@core/models';

export interface Course extends BaseEntity {
  code: string;
  name: string;
  description?: string;
  credits?: number;
  isActive: boolean;
}

export interface ClassGroup extends BaseEntity {
  courseId: string;
  name: string;
  teacherId?: string;
  schedule?: string;
  capacity?: number;
}

export interface Grade extends BaseEntity {
  studentId: string;
  classId: string;
  value: number;
  weight?: number;
  comment?: string;
  evaluatedAt: string;
}
