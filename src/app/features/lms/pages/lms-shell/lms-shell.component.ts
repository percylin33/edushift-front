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
  RouterLinkActive,
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
} from '../../services/lms-section-context.service';

type LmsSectionTab = 'assignments' | 'materials' | 'quizzes';

/**
 * Shell del feature LMS — cabecera de aula (materia/sección/periodo) + tabs.
 */
@Component({
  selector: 'app-lms-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, IconComponent],
  template: `
    <section class="mx-auto max-w-6xl p-6">
      @if (sectionUuid()) {
        <nav class="mb-6 space-y-4" aria-label="Navegación del aula">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <h1 class="text-xl font-semibold text-content">Aula</h1>
              @if (aulaSubtitle(); as subtitle) {
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

          <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            @if (sectionAssignments().length > 0 || allowAllAssignments()) {
              <div class="min-w-[12rem] max-w-md flex-1">
                <label class="label" for="lms-assignment-select">Materia</label>
                <select
                  id="lms-assignment-select"
                  class="select"
                  [ngModel]="selectedAssignmentUuid()"
                  (ngModelChange)="onAssignmentChange($event)"
                >
                  @if (allowAllAssignments()) {
                    <option [ngValue]="null">Todas las materias</option>
                  }
                  @for (a of filteredAssignments(); track a.publicUuid) {
                    <option [ngValue]="a.publicUuid">{{ a.courseName }}</option>
                  }
                </select>
              </div>
            }

            @if (sectionOptions().length > 1) {
              <div class="min-w-[12rem] max-w-md flex-1">
                <label class="label" for="lms-section-select">Sección</label>
                <select
                  id="lms-section-select"
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
                <label class="label" for="lms-period-select">Periodo</label>
                <select
                  id="lms-period-select"
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

          <div class="flex flex-wrap gap-1 border-b border-border-subtle pb-1" role="tablist">
            <a
              [routerLink]="sectionTabLink('assignments')"
              [queryParams]="assignmentQuery()"
              routerLinkActive="border-primary-500 text-primary-600"
              class="btn btn-ghost btn-sm rounded-none border-b-2 border-transparent"
              role="tab"
            >
              <app-icon name="clipboard-list" [size]="16" />
              Tareas
            </a>
            <a
              [routerLink]="sectionTabLink('materials')"
              [queryParams]="assignmentQuery()"
              routerLinkActive="border-primary-500 text-primary-600"
              class="btn btn-ghost btn-sm rounded-none border-b-2 border-transparent"
              role="tab"
            >
              <app-icon name="file-text" [size]="16" />
              Materiales
            </a>
            <a
              [routerLink]="sectionTabLink('quizzes')"
              [queryParams]="assignmentQuery()"
              routerLinkActive="border-primary-500 text-primary-600"
              class="btn btn-ghost btn-sm rounded-none border-b-2 border-transparent"
              role="tab"
            >
              <app-icon name="list-checks" [size]="16" />
              Prácticas
            </a>
            <a
              [routerLink]="evaluationsLink()"
              [queryParams]="evaluationsQuery()"
              class="btn btn-ghost btn-sm rounded-none border-b-2 border-transparent"
              role="tab"
            >
              <app-icon name="target" [size]="16" />
              Registros
            </a>
          </div>
        </nav>
      }

      <router-outlet />
    </section>
  `,
})
export class LmsShellComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sectionContext = inject(LmsSectionContextService);
  private readonly academicApi = inject(AcademicApiService);
  private readonly auth = inject(AuthService);

  readonly coursesRoute = ROUTES.LMS.COURSES;

  readonly sectionUuid = signal<string | null>(null);
  readonly sectionOptions = signal<LmsSectionOption[]>([]);
  readonly myAssignments = signal<AssignmentRow[]>([]);
  readonly periods = signal<AcademicPeriodRow[]>([]);
  readonly selectedPeriodUuid = signal<string | null>(null);
  readonly selectedAssignmentUuid = signal<string | null>(null);
  readonly currentPeriodId = signal<string | null>(null);
  /** Section whose materias are currently in {@link myAssignments}. */
  #assignmentsForSection: string | null = null;

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

  /** Periods that have a materia in this section, falling back to the year catalog. */
  readonly periodOptions = computed(() => {
    const catalog = [...this.periods()].sort((a, b) => a.ordinal - b.ordinal);
    if (catalog.length === 0) return [];

    const usedIds = new Set(this.sectionAssignments().map((a) => a.academicPeriodPublicUuid));
    if (usedIds.size === 0) return catalog;

    const fromAssignments = catalog.filter((p) => usedIds.has(p.publicUuid));
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

  readonly allowAllAssignments = computed(
    () => this.auth.hasRole(UserRole.TenantAdmin) && !this.auth.hasRole(UserRole.Teacher),
  );

  readonly showCoursePickerLink = computed(
    () => this.auth.hasRole(UserRole.Teacher) && this.myAssignments().length > 1,
  );

  readonly aulaSubtitle = computed(() => {
    const parts: string[] = [];
    const assignmentUuid = this.selectedAssignmentUuid();
    const assignment = assignmentUuid
      ? this.myAssignments().find((a) => a.publicUuid === assignmentUuid)
      : null;
    if (assignment?.courseName) {
      parts.push(assignment.courseName);
    } else if (this.allowAllAssignments()) {
      parts.push('Todas las materias');
    }
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
        map(() => this.#readSectionUuidFromRoute()),
        startWith(this.#readSectionUuidFromRoute()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((uuid) => {
        this.sectionUuid.set(uuid);
        if (
          uuid &&
          this.auth.hasRole(UserRole.TenantAdmin) &&
          uuid !== this.#assignmentsForSection
        ) {
          void this.#loadAssignments().then(() => this.#syncFromQuery());
          return;
        }
        this.#syncFromQuery();
      });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.#syncFromQuery();
    });
  }

  sectionTabLink(tab: LmsSectionTab): string {
    const uuid = this.sectionUuid();
    if (!uuid) return ROUTES.LMS.ROOT;
    switch (tab) {
      case 'materials':
        return ROUTES.LMS.sectionMaterials(uuid);
      case 'quizzes':
        return ROUTES.LMS.sectionQuizzes(uuid);
      default:
        return ROUTES.LMS.sectionAssignments(uuid);
    }
  }

  assignmentQuery(): { assignment: string } | Record<string, never> {
    const a = this.selectedAssignmentUuid();
    return a ? { assignment: a } : {};
  }

  evaluationsLink(): string {
    const a = this.selectedAssignmentUuid();
    if (a) return ROUTES.EVALUATIONS.byAssignment(a);
    return ROUTES.EVALUATIONS.ROOT;
  }

  evaluationsQuery(): { section: string } | Record<string, never> {
    if (this.selectedAssignmentUuid()) return {};
    const uuid = this.sectionUuid();
    return uuid ? { section: uuid } : {};
  }

  periodOptionLabel(period: AcademicPeriodRow): string {
    const label = formatPeriodLabel(period);
    return period.publicUuid === this.currentPeriodId() ? `${label} (vigente)` : label;
  }

  onSectionChange(nextUuid: string): void {
    const tab = this.#activeTabFromUrl(this.router.url);
    this.sectionUuid.set(nextUuid);
    const period = this.#defaultPeriodId();
    this.selectedPeriodUuid.set(period);
    const assignment = this.#pickDefaultAssignment(nextUuid, period);
    void this.router.navigateByUrl(this.#tabUrl(nextUuid, tab, assignment));
  }

  onPeriodChange(nextPeriodUuid: string | null): void {
    const section = this.sectionUuid();
    if (!section) return;
    this.selectedPeriodUuid.set(nextPeriodUuid);
    const tab = this.#activeTabFromUrl(this.router.url);
    const assignment = this.#pickDefaultAssignment(section, nextPeriodUuid);
    this.selectedAssignmentUuid.set(assignment);
    void this.router.navigateByUrl(this.#tabUrl(section, tab, assignment));
  }

  onAssignmentChange(nextUuid: string | null): void {
    const section = this.sectionUuid();
    if (!section) return;
    const tab = this.#activeTabFromUrl(this.router.url);
    if (nextUuid) {
      const row = this.sectionAssignments().find((a) => a.publicUuid === nextUuid);
      if (row) this.selectedPeriodUuid.set(row.academicPeriodPublicUuid);
    }
    this.selectedAssignmentUuid.set(nextUuid);
    void this.router.navigateByUrl(this.#tabUrl(section, tab, nextUuid));
  }

  async #bootstrap(): Promise<void> {
    await Promise.all([this.#loadSectionOptions(), this.#loadPeriods(), this.#loadAssignments()]);
    this.#syncFromQuery();
  }

  async #loadSectionOptions(): Promise<void> {
    try {
      this.sectionOptions.set(await this.sectionContext.loadSectionOptions());
    } catch {
      this.sectionOptions.set([]);
    }
  }

  async #loadAssignments(): Promise<void> {
    const section = this.sectionUuid() ?? this.#readSectionUuidFromRoute();
    if (section && this.auth.hasRole(UserRole.TenantAdmin)) {
      const rows = await this.sectionContext.loadSectionAssignments(section);
      const current = this.sectionUuid() ?? this.#readSectionUuidFromRoute();
      if (current !== section) return;
      this.#assignmentsForSection = section;
      this.myAssignments.set(rows);
      return;
    }
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

  #syncFromQuery(): void {
    if (!this.#isSectionScopedTabUrl(this.router.url)) {
      return;
    }
    const fromQuery = this.route.snapshot.queryParamMap.get('assignment');
    const assignments = this.sectionAssignments();
    const periodOptions = this.periodOptions();

    if (fromQuery) {
      const match = assignments.find((a) => a.publicUuid === fromQuery);
      if (match) {
        this.selectedPeriodUuid.set(match.academicPeriodPublicUuid);
        this.selectedAssignmentUuid.set(fromQuery);
        return;
      }
    }

    const period =
      this.selectedPeriodUuid() &&
      periodOptions.some((p) => p.publicUuid === this.selectedPeriodUuid())
        ? this.selectedPeriodUuid()
        : this.#defaultPeriodId();
    this.selectedPeriodUuid.set(period);

    if (this.allowAllAssignments() && !fromQuery) {
      this.selectedAssignmentUuid.set(null);
      return;
    }

    const section = this.sectionUuid();
    const picked = this.#pickDefaultAssignment(section, period);
    this.selectedAssignmentUuid.set(picked);
    if (section && picked && picked !== fromQuery) {
      const tab = this.#activeTabFromUrl(this.router.url);
      void this.router.navigateByUrl(this.#tabUrl(section, tab, picked), { replaceUrl: true });
    }
  }

  /** True only on section listing tabs — not on assignment detail/grade/submit routes. */
  #isSectionScopedTabUrl(url: string): boolean {
    return /\/lms\/sections\/[^/?#]+\/(assignments|materials|quizzes)/.test(url);
  }

  #defaultPeriodId(): string | null {
    const options = this.periodOptions();
    if (options.length === 0) return null;
    const inRange = resolveCurrentAcademicPeriod(options);
    if (inRange) return inRange.publicUuid;
    const currentId = this.currentPeriodId();
    if (currentId && options.some((p) => p.publicUuid === currentId)) {
      return currentId;
    }
    return options[0]!.publicUuid;
  }

  #pickDefaultAssignment(
    sectionUuid: string | null,
    periodUuid: string | null,
  ): string | null {
    if (!sectionUuid) return null;
    let rows = this.sectionContext.assignmentsForSection(this.myAssignments(), sectionUuid);
    if (periodUuid) {
      rows = rows.filter((a) => a.academicPeriodPublicUuid === periodUuid);
    }
    rows = [...rows].sort((a, b) => a.courseName.localeCompare(b.courseName, 'es'));
    return rows[0]?.publicUuid ?? null;
  }

  #readSectionUuidFromRoute(): string | null {
    let child: ActivatedRoute | null = this.route;
    while (child?.firstChild) {
      child = child.firstChild;
    }
    const fromParam = child?.snapshot.paramMap.get('sectionUuid');
    if (fromParam && fromParam !== '_') return fromParam;

    const match = this.router.url.match(/\/lms\/sections\/([^/?#]+)/);
    return match?.[1] && match[1] !== '_' ? match[1] : null;
  }

  #activeTabFromUrl(url: string): LmsSectionTab {
    if (url.includes('/materials')) return 'materials';
    if (url.includes('/quizzes')) return 'quizzes';
    return 'assignments';
  }

  #tabUrl(sectionUuid: string, tab: LmsSectionTab, assignmentUuid: string | null): string {
    let path: string;
    switch (tab) {
      case 'materials':
        path = ROUTES.LMS.sectionMaterials(sectionUuid);
        break;
      case 'quizzes':
        path = ROUTES.LMS.sectionQuizzes(sectionUuid);
        break;
      default:
        path = ROUTES.LMS.sectionAssignments(sectionUuid);
    }
    return assignmentUuid ? `${path}?assignment=${encodeURIComponent(assignmentUuid)}` : path;
  }
}
