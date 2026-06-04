import { BaseEntity } from '@core/models';

export type StudentStatus = 'active' | 'inactive' | 'graduated' | 'withdrawn';

export interface Student extends BaseEntity {
  code: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  status: StudentStatus;
  gradeLevel?: string;
  guardianIds?: string[];
}

export interface CreateStudentRequest {
  code: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  gradeLevel?: string;
}

export type UpdateStudentRequest = Partial<CreateStudentRequest> & {
  status?: StudentStatus;
};

export interface StudentListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: StudentStatus;
  gradeLevel?: string;
}
