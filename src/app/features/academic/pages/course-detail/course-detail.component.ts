import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import {
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent
} from '@shared/components';
import {
  CourseFormModalComponent,
  CourseUnitsTabComponent,
  CourseCompetenciesTabComponent
} from '../../components';
import { AcademicStore } from '../../store';

type CourseTab = 'info' | 'units' | 'competencies';

/**
 * `/academic/courses/:id` — vista detail de un curso con tabs:
 * <em>Info</em>, <em>Unidades</em> (FE-5A.1) y <em>Competencias</em>
 * (placeholder para FE-5A.2).
 *
 * <p>El tab <strong>Info</strong> resume la metadata + chips de
 * niveles asociados y permite editar/eliminar el curso reusando el
 * modal del listado. <strong>Unidades</strong> delega en
 * {@link CourseUnitsTabComponent} (drag-drop reorder + CRUD vía
 * {@code UnitsStore}). <strong>Competencias</strong> queda como
 * placeholder hasta que aterrice FE-5A.2.</p>
 *
 * <p>El tab activo se persiste en {@code ?tab=…} para que un refresh
 * (F5) o el botón "atrás" no resetee la navegación interna — espeja
 * el patrón que ya implementa {@code section-detail}.</p>
 */
@Component({
  selector: 'app-course-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    IconComponent,
    SpinnerComponent,
    CourseFormModalComponent,
    CourseUnitsTabComponent,
    CourseCompetenciesTabComponent
  ],
  template: `
    <app-page-container>
      @if (course(); as c) {
        <app-page-header
          eyebrow="Académico · Cursos"
          [title]="c.code + ' — ' + c.name"
          [subtitle]="
            c.levels.length === 1
              ? 'Nivel: ' + c.levels[0].name
              : c.levels.length + ' niveles asociados'
          "
        >
          <a [routerLink]="listRoute" class="btn btn-ghost btn-sm">
            <app-icon name="arrow-left" [size]="16" />
            <span class="hidden sm:inline">Volver</span>
          </a>
          <button type="button" class="btn btn-outline btn-sm" (click)="openEdit()">
            <app-icon name="edit-2" [size]="16" />
            <span class="hidden sm:inline">Editar curso</span>
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-sm text-danger-600 hover:bg-danger-50"
            [disabled]="saving()"
            (click)="confirmDelete()"
          >
            <app-icon name="trash-2" [size]="16" />
            <span class="hidden sm:inline">Eliminar</span>
          </button>
        </app-page-header>

        <!-- Tabs -->
        <nav class="card mb-4">
          <div role="tablist" class="flex gap-1 px-2 pt-2">
            @for (t of tabs; track t.id) {
              <button
                role="tab"
                type="button"
                [attr.aria-selected]="activeTab() === t.id"
                [class.tab-active]="activeTab() === t.id"
                class="tab"
                (click)="setTab(t.id)"
              >
                <app-icon [name]="t.icon" [size]="16" />
                <span>{{ t.label }}</span>

              </button>
            }
          </div>
        </nav>

        <!-- Tab content -->
        @switch (activeTab()) {
          @case ('info') {
            <section class="card">
              <div class="card-body grid gap-4 sm:grid-cols-2">
                <div>
                  <p class="text-xs uppercase text-content-muted">Código</p>
                  <p class="mt-1 font-mono text-sm font-semibold">{{ c.code }}</p>
                </div>
                <div>
                  <p class="text-xs uppercase text-content-muted">Estado</p>
                  <p class="mt-1">
                    @if (c.isActive) {
                      <span class="badge badge-success">Activo</span>
                    } @else {
                      <span class="badge badge-neutral">Inactivo</span>
                    }
                  </p>
                </div>
                <div class="sm:col-span-2">
                  <p class="text-xs uppercase text-content-muted">Nombre</p>
                  <p class="mt-1 font-medium">{{ c.name }}</p>
                </div>
                @if (c.description) {
                  <div class="sm:col-span-2">
                    <p class="text-xs uppercase text-content-muted">Descripción</p>
                    <p class="mt-1 text-sm whitespace-pre-line">{{ c.description }}</p>
                  </div>
                }
                <div>
                  <p class="text-xs uppercase text-content-muted">Horas / semana</p>
                  <p class="mt-1 font-medium">{{ c.hoursPerWeek ?? '—' }}</p>
                </div>
                <div>
                  <p class="text-xs uppercase text-content-muted">Créditos</p>
                  <p class="mt-1 font-medium">{{ c.credits ?? '—' }}</p>
                </div>
                <div class="sm:col-span-2">
                  <p class="text-xs uppercase text-content-muted">Niveles asociados</p>
                  <div class="mt-1 flex flex-wrap gap-1">
                    @for (lv of c.levels; track lv.publicUuid) {
                      <span class="badge badge-neutral text-[11px]" [title]="lv.name">
                        {{ lv.code }} — {{ lv.name }}
                      </span>
                    }
                  </div>
                </div>
                @if (c.createdAt) {
                  <div>
                    <p class="text-xs uppercase text-content-muted">Creado</p>
                    <p class="mt-1 text-sm">{{ formatDateTime(c.createdAt) }}</p>
                  </div>
                }
                @if (c.updatedAt) {
                  <div>
                    <p class="text-xs uppercase text-content-muted">Última edición</p>
                    <p class="mt-1 text-sm">{{ formatDateTime(c.updatedAt) }}</p>
                  </div>
                }
              </div>
            </section>
          }
          @case ('units') {
            <app-course-units-tab [courseUuid]="c.publicUuid" />
          }
          @case ('competencies') {
            <app-course-competencies-tab [courseUuid]="c.publicUuid" />
          }
        }
      } @else if (loading()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando curso…" />
        </div>
      } @else {
        <div class="alert alert-danger">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">No pudimos cargar el curso.</p>
            @if (errorMessage()) {
              <p class="mt-1 text-xs opacity-80">{{ errorMessage() }}</p>
            }
          </div>
          <a [routerLink]="listRoute" class="btn btn-ghost btn-sm">
            Volver al listado
          </a>
        </div>
      }
    </app-page-container>

    @if (showEdit()) {
      @if (course(); as c) {
        <app-course-form-modal
          [course]="c"
          (closed)="closeEdit()"
          (saved)="onSaved()"
        />
      }
    }
  `
})
export class CourseDetailComponent implements OnInit {
  private readonly store = inject(AcademicStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly listRoute = ROUTES.ACADEMIC.COURSES.LIST;

  protected readonly course = this.store.selectedCourse;
  protected readonly loading = this.store.loadingCourseDetail;
  protected readonly saving = this.store.savingCourse;
  protected readonly errorMessage = this.store.error;

  protected readonly activeTab = signal<CourseTab>('info');
  protected readonly showEdit = signal(false);

  protected readonly tabs: ReadonlyArray<{
    id: CourseTab;
    label: string;
    icon: 'info' | 'book-open' | 'target';
  }> = [
    { id: 'info',         label: 'Info',         icon: 'info' },
    { id: 'units',        label: 'Unidades',     icon: 'book-open' },
    { id: 'competencies', label: 'Competencias', icon: 'target' }
  ];

  /** Slug humano para alerts/log. */
  protected readonly courseLabel = computed(() => {
    const c = this.course();
    return c ? `${c.code} — ${c.name}` : '—';
  });

  async ngOnInit(): Promise<void> {
    /* Tab desde queryParam (sticky entre refreshes). */
    const tab = this.route.snapshot.queryParamMap.get('tab') as CourseTab | null;
    if (tab && this.tabs.some((t) => t.id === tab)) {
      this.activeTab.set(tab);
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate([this.listRoute]);
      return;
    }
    await this.store.loadCourseDetail(id);
  }

  protected setTab(tab: CourseTab): void {
    this.activeTab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  protected openEdit(): void {
    this.showEdit.set(true);
  }

  protected closeEdit(): void {
    this.showEdit.set(false);
  }

  protected onSaved(): void {
    /* El modal ya hizo update del slice via store.updateCourse(); no
     * necesitamos re-fetch del detail. */
    this.closeEdit();
  }

  protected async confirmDelete(): Promise<void> {
    const c = this.course();
    if (!c) return;
    const ok = confirm(
      `¿Eliminar el curso "${c.code} — ${c.name}"?\n\n` +
        'Si el curso tiene asignaciones de docentes, considera ' +
        'desactivarlo en su lugar.'
    );
    if (!ok) return;
    const success = await this.store.deleteCourse(c.publicUuid);
    if (success) {
      void this.router.navigate([this.listRoute]);
    }
  }

  protected formatDateTime(date: Date | undefined): string {
    if (!date) return '—';
    return date.toLocaleString('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
