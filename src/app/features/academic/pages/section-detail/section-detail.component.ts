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
  AcademicYearStatusBadgeComponent,
  SectionFormModalComponent,
  SectionRosterTabComponent,
  SectionTeachersTabComponent,
  SectionScheduleTabComponent
} from '../../components';
import { AcademicStore } from '../../store';
import { isSectionMutable } from '../../models';

type SectionTab = 'info' | 'roster' | 'teachers' | 'schedule';

/**
 * `/academic/sections/:id` — vista detail de una sección con tabs
 * <em>Info</em>, <em>Roster</em> y <em>Docentes</em>.
 *
 * <p>El tab <strong>Info</strong> muestra la metadata + permite
 * editar/eliminar. <strong>Roster</strong> consume
 * {@code GET /v1/academic/sections/&#123;uuid&#125;/students} (BE-4.8)
 * para listar los estudiantes con matrícula activa. <strong>Docentes</strong>
 * consume {@code GET /v1/academic/sections/&#123;uuid&#125;/teachers}
 * (BE-4.7) para listar las asignaciones (teacher, course, period)
 * vigentes en la sección. Ambos tabs son <em>read-only</em>: las
 * mutaciones se ejecutan desde {@code teacher-detail} y
 * {@code student-detail} respectivamente.</p>
 *
 * <p>El tab activo se persiste en {@code ?tab=…} para que un refresh
 * (F5) no resetee la navegación interna.</p>
 */
@Component({
  selector: 'app-section-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    IconComponent,
    SpinnerComponent,
    AcademicYearStatusBadgeComponent,
    SectionFormModalComponent,
    SectionRosterTabComponent,
    SectionTeachersTabComponent,
    SectionScheduleTabComponent
  ],
  template: `
    <app-page-container>
      @if (section(); as sec) {
        <app-page-header
          eyebrow="Académico · Secciones"
          [title]="sec.gradeName + ' — ' + sec.name"
          [subtitle]="
            'Año académico ' + sec.academicYearName + ' · Nivel ' + sec.levelName
          "
        >
          <a [routerLink]="listRoute" class="btn btn-ghost btn-sm">
            <app-icon name="arrow-left" [size]="16" />
            <span class="hidden sm:inline">Volver</span>
          </a>
          @if (canMutate()) {
            <button type="button" class="btn btn-outline btn-sm" (click)="openEdit()">
              <app-icon name="edit-2" [size]="16" />
              <span class="hidden sm:inline">Editar</span>
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
          }
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
                  <p class="text-xs uppercase text-content-muted">Año académico</p>
                  <div class="mt-1 flex items-center gap-2">
                    <span class="font-medium">{{ sec.academicYearName }}</span>
                    <app-academic-year-status-badge [status]="sec.academicYearStatus" />
                  </div>
                </div>
                <div>
                  <p class="text-xs uppercase text-content-muted">Nivel</p>
                  <p class="mt-1 font-medium">
                    {{ sec.levelName }}
                    <span class="text-content-muted text-sm">({{ sec.levelCode }})</span>
                  </p>
                </div>
                <div>
                  <p class="text-xs uppercase text-content-muted">Grado</p>
                  <p class="mt-1 font-medium">{{ sec.gradeName }}</p>
                </div>
                <div>
                  <p class="text-xs uppercase text-content-muted">Nombre de la sección</p>
                  <p class="mt-1 font-medium">{{ sec.name }}</p>
                </div>
                <div>
                  <p class="text-xs uppercase text-content-muted">Capacidad</p>
                  <p class="mt-1 font-medium">{{ sec.capacity ?? '—' }}</p>
                </div>
                <div>
                  <p class="text-xs uppercase text-content-muted">Display order</p>
                  <p class="mt-1 font-medium">{{ sec.displayOrder ?? '—' }}</p>
                </div>
                @if (sec.createdAt) {
                  <div>
                    <p class="text-xs uppercase text-content-muted">Creado</p>
                    <p class="mt-1 text-sm">{{ formatDateTime(sec.createdAt) }}</p>
                  </div>
                }
                @if (sec.updatedAt) {
                  <div>
                    <p class="text-xs uppercase text-content-muted">Última edición</p>
                    <p class="mt-1 text-sm">{{ formatDateTime(sec.updatedAt) }}</p>
                  </div>
                }
              </div>
            </section>
          }
          @case ('roster') {
            <app-section-roster-tab [sectionPublicUuid]="sec.publicUuid" />
          }
          @case ('teachers') {
            <app-section-teachers-tab [sectionPublicUuid]="sec.publicUuid" />
          }
          @case ('schedule') {
            <app-section-schedule-tab [sectionPublicUuid]="sec.publicUuid" />
          }
        }
      } @else if (loading()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando sección…" />
        </div>
      } @else {
        <div class="alert alert-danger">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">No pudimos cargar la sección.</p>
            @if (errorMessage()) {
              <p class="mt-1 text-xs opacity-80">{{ errorMessage() }}</p>
            }
          </div>
          <a [routerLink]="listRoute" class="btn btn-ghost btn-sm">Volver al listado</a>
        </div>
      }
    </app-page-container>

    @if (showEdit()) {
      @if (section(); as sec) {
        <app-section-form-modal
          [section]="sec"
          (closed)="closeEdit()"
          (saved)="onSaved()"
        />
      }
    }
  `
})
export class SectionDetailComponent implements OnInit {
  private readonly store = inject(AcademicStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly listRoute = ROUTES.ACADEMIC.SECTIONS.LIST;

  protected readonly section = this.store.selectedSection;
  protected readonly loading = this.store.loadingSectionDetail;
  protected readonly saving = this.store.savingSection;
  protected readonly errorMessage = this.store.error;

  protected readonly activeTab = signal<SectionTab>('info');
  protected readonly showEdit = signal(false);

  protected readonly canMutate = computed(() => {
    const s = this.section();
    return s ? isSectionMutable(s.academicYearStatus) : false;
  });

  protected readonly tabs: ReadonlyArray<{
    id: SectionTab;
    label: string;
    icon: 'info' | 'users' | 'user' | 'calendar';
  }> = [
    { id: 'info',     label: 'Info',     icon: 'info' },
    { id: 'roster',   label: 'Roster',   icon: 'users' },
    { id: 'teachers', label: 'Docentes', icon: 'user' },
    { id: 'schedule', label: 'Horario',  icon: 'calendar' }
  ];

  async ngOnInit(): Promise<void> {
    /* Tab desde queryParam (sticky entre refreshes). */
    const tab = this.route.snapshot.queryParamMap.get('tab') as SectionTab | null;
    if (tab && this.tabs.some((t) => t.id === tab)) {
      this.activeTab.set(tab);
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate([this.listRoute]);
      return;
    }
    await this.store.loadSectionDetail(id);
  }

  protected setTab(tab: SectionTab): void {
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

  protected async onSaved(): Promise<void> {
    this.closeEdit();
    /* loadSectionDetail no es necesario: el modal ya actualizó el
     * `_selectedSection` vía store.updateSection(). */
  }

  protected async confirmDelete(): Promise<void> {
    const sec = this.section();
    if (!sec) return;
    const ok = confirm(
      `¿Eliminar la sección "${sec.gradeName} ${sec.name}" del año "${sec.academicYearName}"?\n\n` +
        'Esta operación es reversible solo desde el backend.'
    );
    if (!ok) return;
    const success = await this.store.deleteSection(sec.publicUuid);
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
