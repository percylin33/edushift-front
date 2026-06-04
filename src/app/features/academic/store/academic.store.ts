import { Injectable, computed, signal } from '@angular/core';
import { ClassGroup, Course, Grade } from '../models';

@Injectable({ providedIn: 'root' })
export class AcademicStore {
  private readonly _courses = signal<Course[]>([]);
  private readonly _classes = signal<ClassGroup[]>([]);
  private readonly _grades = signal<Grade[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly courses = this._courses.asReadonly();
  readonly classes = this._classes.asReadonly();
  readonly grades = this._grades.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly activeCourses = computed(() => this._courses().filter((c) => c.isActive));

  setCourses(courses: Course[]): void { this._courses.set(courses); }
  setClasses(classes: ClassGroup[]): void { this._classes.set(classes); }
  setGrades(grades: Grade[]): void { this._grades.set(grades); }
  setLoading(value: boolean): void { this._loading.set(value); }
  setError(error: string | null): void { this._error.set(error); }

  reset(): void {
    this._courses.set([]);
    this._classes.set([]);
    this._grades.set([]);
    this._loading.set(false);
    this._error.set(null);
  }
}
