import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { Paginated } from '@core/models';
import { ClassGroup, Course, Grade } from '../models';

@Injectable({ providedIn: 'root' })
export class AcademicApiService {
  private readonly api = inject(ApiService);

  listCourses(): Observable<Paginated<Course>> {
    return this.api.get<Paginated<Course>>(API.ACADEMIC.COURSES);
  }

  listClasses(courseId?: string): Observable<Paginated<ClassGroup>> {
    return this.api.get<Paginated<ClassGroup>>(API.ACADEMIC.CLASSES, { courseId });
  }

  listGrades(classId: string): Observable<Paginated<Grade>> {
    return this.api.get<Paginated<Grade>>(API.ACADEMIC.GRADES, { classId });
  }
}
