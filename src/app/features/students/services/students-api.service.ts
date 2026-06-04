import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { Paginated } from '@core/models';
import {
  CreateStudentRequest,
  Student,
  StudentListParams,
  UpdateStudentRequest
} from '../models';

@Injectable({ providedIn: 'root' })
export class StudentsApiService {
  private readonly api = inject(ApiService);

  list(params: StudentListParams = {}): Observable<Paginated<Student>> {
    return this.api.get<Paginated<Student>>(API.STUDENTS.ROOT, params);
  }

  get(id: string): Observable<Student> {
    return this.api.get<Student>(`${API.STUDENTS.ROOT}/${id}`);
  }

  create(payload: CreateStudentRequest): Observable<Student> {
    return this.api.post<Student>(API.STUDENTS.ROOT, payload);
  }

  update(id: string, payload: UpdateStudentRequest): Observable<Student> {
    return this.api.patch<Student>(`${API.STUDENTS.ROOT}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${API.STUDENTS.ROOT}/${id}`);
  }
}
