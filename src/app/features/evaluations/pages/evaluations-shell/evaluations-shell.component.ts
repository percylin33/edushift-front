import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { filter, map, startWith } from 'rxjs/operators';
import { ROUTES } from '@core/constants';
import { UserRole } from '@core/enums';
import { AuthService } from '@core/services';
import { IconComponent } from '@shared/components';
import {
  AcademicPeriodRow,
  AcademicYearStatus,
  formatPeriodLabel,
  resolveCurrentAcademicPeriod,
} from '@features/academic/models';
import { AcademicApiService } from '@features/academic/services';
import { AssignmentRow } from '@features/teachers/models';
import {
  LmsSectionContextService,
  LmsSectionOption,
} from '@features/lms/services/lms-section-context.service';

/**
 * Shell de Registros — cabecera Materia / Sección / Periodo sobre by-assignment.
 */
@Component({
  selector: 'app-evaluations-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, FormsModule, IconComponent],
  template: `
    <section class="mx-auto max-w-6xl p-6">
      @if (assignmentUuid()) {
        <nav class="mb-6 space-y-4" aria-label="Contexto de registros">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <h1 class="text-xl font-semibold text-content">Registros</h1>
              @if (contextSubtitle(); as subtitle) {
                <p class="mt-0.5 truncate text-sm text-content-muted">{{ subtitle }}</p>
              }
            </div>
            @if (showCoursePickerLink()) {
              <a [routerLink]="coursesRoute" class="btn btn-ghost btn-sm shrink-0 self-start">
                <app-icon name="layout-grid" [size]="16" />
                Cambiar curso
              </a>
            }
          </div>

          @if (myAssignments().length > 0) {
            <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              @if (filteredAssignments().length > 0) {
                <div class="min-w-[12rem] max-w-md flex-1">
                  <label class="label" for="eval-assignment-select">Materia</label>
                  <select
                    id="eval-assignment-select"
                    class="select"
                    [ngModel]="assignmentUuid()"
                    (ngModelChange)="onAssignmentChange($event)"
                  >
                    @for (a of filteredAssignments(); track a.publicUuid) {
                      <option [ngValue]="a.publicUuid">{{ a.courseName }}</option>
                    }
                  </select>
                </div>
              }

              @if (sectionOptions().length > 1) {
                <div class="min-w-[12rem] max-w-md flex-1">
                  <label class="label" for="eval-section-select">Sección</label>
                  <select
                    id="eval-section-select"
                    class="select"
                    [ngModel]="sectionUuid()"
                    (ngModelChange)="onSectionChange($event)"
                  >
                    @for (opt of sectionOptions(); track opt.publicUuid) {
                      <option [ngValue]="opt.publicUuid">{{ opt.label }}</option>
                    }
                  </select>
                </div>
              } @else if (currentSectionLabel()) {
                <p class="pb-2 text-sm text-content-muted">
                  Sección:
                  <span class="font-medium text-content">{{ currentSectionLabel() }}</span>
                </p>
              }

              @if (periodOptions().length > 0) {
                <div class="min-w-[12rem] max-w-xs flex-1">
                  <label class="label" for="eval-period-select">Periodo</label>
                  <select
                    id="eval-period-select"
                    class="select"
                    [ngModel]="selectedPeriodUuid()"
                    (ngModelChange)="onPeriodChange($event)"
                  >
                    @for (p of periodOptions(); track p.publicUuid) {
                      <option [ngValue]="p.publicUuid">{{ periodOptionLabel(p) }}</option>
                    }
                  </select>
                </div>
              }
            </div>
          }
        </nav>
      }

      <router-outlet />
    </section>
  `,
})
export class EvaluationsShellComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sectionContext = inject(LmsSectionContextService);
  private readonly academicApi = inject(AcademicApiService);
  private readonly auth = inject(AuthService);

  readonly coursesRoute = ROUTES.EVALUATIONS.COURSES;

  readonly assignmentUuid = signal<string | null>(null);
  readonly sectionUuid = signal<string | null>(null);
  readonly sectionOptions = signal<LmsSectionOption[]>([]);
  readonly myAssignments = signal<AssignmentRow[]>([]);
  readonly periods = signal<AcademicPeriodRow[]>([]);
  readonly selectedPeriodUuid = signal<string | null>(null);
  readonly currentPeriodId = signal<string | null>(null);

  readonly currentSectionLabel = computed(() => {
    const uuid = this.sectionUuid();
    if (!uuid) return null;
    return this.sectionOptions().find((o) => o.publicUuid === uuid)?.label ?? null;
  });

  readonly sectionAssignments = computed(() => {
    const uuid = this.sectionUuid();
    if (!uuid) return [];
    return this.sectionContext.assignmentsForSection(this.myAssignments(), uuid);
  });

  readonly periodOptions = computed(() => {
    const catalog = [...this.periods()].sort((a, b) => a.ordinal - b.ordinal);
    if (catalog.length === 0) return [];

    const usedIds = new Set(this.sectionAssignments().map((a) => a.academicPeriodPublicUuid));
    if (usedIds.size === 0) return catalog;

    const fromAssignments = catalog.filter((p) => usedIds.has(p.publicUuid));
    const currentId = this.currentPeriodId();
    if (currentId && !fromAssignments.some((p) => p.publicUuid === currentId)) {
      const current = catalog.find((p) => p.publicUuid === currentId);
      if (current) return [...fromAssignments, current].sort((a, b) => a.ordinal - b.ordinal);
    }
    return fromAssignments.length > 0 ? fromAssignments : catalog;
  });

  readonly filteredAssignments = computed(() => {
    const periodId = this.selectedPeriodUuid();
    const rows = this.sectionAssignments();
    if (!periodId) return rows;
    return rows
      .filter((a) => a.academicPeriodPublicUuid === periodId)
      .sort((a, b) => a.courseName.localeCompare(b.courseName, 'es'));
  });

  readonly showCoursePickerLink = computed(
    () => this.auth.hasRole(UserRole.Teacher) && this.myAssignments().length > 1,
  );

  readonly contextSubtitle = computed(() => {
    const parts: string[] = [];
    const assignment = this.#currentAssignment();
    if (assignment?.courseName) parts.push(assignment.courseName);
    const section = this.currentSectionLabel();
    if (section) parts.push(section);
    const periodUuid = this.selectedPeriodUuid();
    const period = periodUuid
      ? this.periodOptions().find((p) => p.publicUuid === periodUuid)
      : null;
    if (period) parts.push(formatPeriodLabel(period));
    return parts.length > 0 ? parts.join(' · ') : null;
  });

  ngOnInit(): void {
    void this.#bootstrap();

    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        map(() => this.#readAssignmentUuidFromRoute()),
        startWith(this.#readAssignmentUuidFromRoute()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((uuid) => {
        this.assignmentUuid.set(uuid);
        this.#syncFromAssignment(uuid);
      });
  }

  periodOptionLabel(period: AcademicPeriodRow): string {
    const label = formatPeriodLabel(period);
    return period.publicUuid === this.currentPeriodId() ? `${label} (vigente)` : label;
  }

  onAssignmentChange(nextUuid: string): void {
    void this.router.navigateByUrl(this.#urlForAssignment(nextUuid));
  }

  onSectionChange(nextSectionUuid: string): void {
    this.sectionUuid.set(nextSectionUuid);
    const period = this.selectedPeriodUuid() ?? this.#defaultPeriodId();
    this.selectedPeriodUuid.set(period);
    const preferredCourse = this.#currentAssignment()?.coursePublicUuid ?? null;
    const picked = this.#pickAssignment(nextSectionUuid, period, preferredCourse);
    if (picked) {
      void this.router.navigateByUrl(this.#urlForAssignment(picked));
    }
  }

  onPeriodChange(nextPeriodUuid: string): void {
    this.selectedPeriodUuid.set(nextPeriodUuid);
    const section = this.sectionUuid();
    if (!section) return;
    const preferredCourse = this.#currentAssignment()?.coursePublicUuid ?? null;
    const picked = this.#pickAssignment(section, nextPeriodUuid, preferredCourse);
    if (picked) {
      void this.router.navigateByUrl(this.#urlForAssignment(picked));
    }
  }

  async #bootstrap(): Promise<void> {
    await Promise.all([this.#loadSectionOptions(), this.#loadPeriods(), this.#loadAssignments()]);
    this.#syncFromAssignment(this.assignmentUuid());
  }

  async #loadSectionOptions(): Promise<void> {
    try {
      this.sectionOptions.set(await this.sectionContext.loadSectionOptions());
    } catch {
      this.sectionOptions.set([]);
    }
  }

  async #loadAssignments(): Promise<void> {
    this.myAssignments.set(await this.sectionContext.loadMyAssignments());
  }

  async #loadPeriods(): Promise<void> {
    try {
      const years = await firstValueFrom(this.academicApi.listYears());
      const activeYear = years.find((y) => y.status === AcademicYearStatus.Active) ?? null;
      if (!activeYear) {
        this.periods.set([]);
        this.currentPeriodId.set(null);
        return;
      }
      const periods = await firstValueFrom(
        this.academicApi.listPeriods({ academicYearPublicUuid: activeYear.publicUuid }),
      );
      this.periods.set(periods);
      const current = resolveCurrentAcademicPeriod(periods);
      this.currentPeriodId.set(current?.publicUuid ?? null);
    } catch {
      this.periods.set([]);
      this.currentPeriodId.set(null);
    }
  }

  #syncFromAssignment(uuid: string | null): void {
    if (!uuid) return;
    const match = this.myAssignments().find((a) => a.publicUuid === uuid);
    if (match) {
      this.sectionUuid.set(match.sectionPublicUuid);
      this.selectedPeriodUuid.set(match.academicPeriodPublicUuid);
      return;
    }
    // Deep-link admin / assignment no propia: keep route uuid, clear section context selects.
    this.sectionUuid.set(null);
    this.selectedPeriodUuid.set(null);
  }

  #currentAssignment(): AssignmentRow | null {
    const uuid = this.assignmentUuid();
    if (!uuid) return null;
    return this.myAssignments().find((a) => a.publicUuid === uuid) ?? null;
  }

  #defaultPeriodId(): string | null {
    const options = this.periodOptions();
    if (options.length === 0) return null;
    const currentId = this.currentPeriodId();
    if (currentId && options.some((p) => p.publicUuid === currentId)) {
      return currentId;
    }
    return options[0]!.publicUuid;
  }

  #pickAssignment(
    sectionUuid: string,
    periodUuid: string | null,
    preferredCourseUuid: string | null,
  ): string | null {
    let rows = this.sectionContext.assignmentsForSection(this.myAssignments(), sectionUuid);
    if (periodUuid) {
      rows = rows.filter((a) => a.academicPeriodPublicUuid === periodUuid);
    }
    if (preferredCourseUuid) {
      const sameCourse = rows.find((a) => a.coursePublicUuid === preferredCourseUuid);
      if (sameCourse) return sameCourse.publicUuid;
    }
    rows = [...rows].sort((a, b) => a.courseName.localeCompare(b.courseName, 'es'));
    return rows[0]?.publicUuid ?? null;
  }

  #readAssignmentUuidFromRoute(): string | null {
    let child: ActivatedRoute | null = this.route;
    while (child?.firstChild) {
      child = child.firstChild;
    }
    const fromParam = child?.snapshot.paramMap.get('assignmentUuid');
    if (fromParam) return fromParam;

    const match = this.router.url.match(/\/evaluations\/by-assignment\/([^/?#]+)/);
    return match?.[1] ?? null;
  }

  #urlForAssignment(assignmentUuid: string): string {
    const onGradebook = /\/evaluations\/by-assignment\/[^/?#]+\/gradebook/.test(this.router.url);
    return onGradebook
      ? ROUTES.EVALUATIONS.gradeBook(assignmentUuid)
      : ROUTES.EVALUATIONS.byAssignment(assignmentUuid);
  }
}
