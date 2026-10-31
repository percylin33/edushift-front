import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MeGradesSummary } from '../../models/me-grades-summary.model';
import { MeApiService } from '../../services/me-api.service';
import { MeGradesPageComponent } from './me-grades.page';

describe('MeGradesPageComponent', () => {
  let fixture: ComponentFixture<MeGradesPageComponent>;
  let api: jasmine.SpyObj<MeApiService>;

  const numericSummary: MeGradesSummary = {
    period: { publicUuid: 'p1', name: 'Bimestre I', current: true },
    overallAverage: 16,
    courseCount: 1,
    gradedCourseCount: 1,
    gradedCount: 1,
    courses: [
      {
        assignmentPublicUuid: 'a1',
        coursePublicUuid: 'c1',
        courseName: 'Matemática',
        sectionName: '3° A',
        teacherName: 'Carlos Paredes',
        scale: 'SCORE_0_20',
        average: 16,
        literalAverage: null,
        categories: [
          {
            publicUuid: 'cat1',
            name: 'Exámenes',
            weight: 40,
            average: 16,
            literalAverage: null,
          },
        ],
      },
    ],
    items: [
      {
        publicUuid: 'g1',
        assignmentPublicUuid: 'a1',
        coursePublicUuid: 'c1',
        courseName: 'Matemática',
        sectionName: '3° A',
        evaluationName: 'Examen 1',
        kind: 'EXAM',
        weight: 40,
        scale: 'SCORE_0_20',
        score: 16,
        maxScore: 20,
        literal: null,
        comments: 'Buen trabajo',
        teacherName: 'Carlos Paredes',
        periodPublicUuid: 'p1',
        scheduledDate: '2026-09-03T00:00:00Z',
        recordedAt: '2026-09-03T15:00:00Z',
        countsTowardAverage: true,
        source: 'REGISTER',
        role: 'OFFICIAL',
      },
    ],
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj('MeApiService', ['listSectionPeriods', 'gradesSummary']);
    api.listSectionPeriods.and.returnValue(of({
      data: [
        { publicUuid: 'p1', name: 'Bimestre I', ordinal: 1, current: true },
        { publicUuid: 'p2', name: 'Bimestre II', ordinal: 2, current: false },
      ],
    }));
    api.gradesSummary.and.returnValue(of({ data: numericSummary }));

    await TestBed.configureTestingModule({
      imports: [MeGradesPageComponent],
      providers: [provideRouter([]), { provide: MeApiService, useValue: api }],
    }).compileComponents();

    fixture = TestBed.createComponent(MeGradesPageComponent);
    fixture.detectChanges();
  });

  it('groups grades by course and shows the period average', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Matemática');
    expect(text).toContain('16 / 20');
    expect(text).toContain('Examen 1');
    expect(text).toContain('Exámenes');
    expect(text).not.toContain('No entra al promedio');
    expect(fixture.nativeElement.querySelector('[data-testid="course-card"]')).not.toBeNull();
  });

  it('reloads the summary when the period changes', () => {
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('[data-testid="period-select"]');
    select.value = 'p2';
    select.dispatchEvent(new Event('change'));
    expect(api.gradesSummary).toHaveBeenCalledWith('p2');
  });

  it('shows the empty state when the period has no courses', () => {
    api.gradesSummary.and.returnValue(of({
      data: {
        ...numericSummary,
        overallAverage: null,
        courseCount: 0,
        gradedCourseCount: 0,
        gradedCount: 0,
        courses: [],
        items: [],
      },
    }));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="empty-grades"]')).not.toBeNull();
  });

  it('shows the CNEB letter and legend', () => {
    api.gradesSummary.and.returnValue(of({
      data: {
        ...numericSummary,
        overallAverage: null,
        courses: [
          {
            ...numericSummary.courses[0],
            courseName: 'Comunicación',
            scale: 'LITERAL_CNEB',
            average: null,
            literalAverage: 'AD',
            categories: [],
          },
        ],
        items: [
          {
            ...numericSummary.items[0],
            evaluationName: 'Competencia 1',
            kind: 'COMPETENCY',
            scale: 'LITERAL_CNEB',
            score: null,
            maxScore: null,
            literal: 'AD',
          },
        ],
      },
    }));
    fixture.componentInstance.load();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('AD');
    expect(text).not.toContain('18–20');
    expect(fixture.nativeElement.querySelector('[data-testid="cneb-legend"]')).not.toBeNull();
  });
});
