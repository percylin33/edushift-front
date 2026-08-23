import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { UserRole } from '@core/enums';
import { AuthService } from '@core/services';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import { AcademicApiService } from '@features/academic/services';

/**
 * `/lms` landing (FE-7a.5 / BUG-2026-07-30-05).
 *
 * <p>Replaces the previous static redirect to
 * {@code /lms/sections/_/assignments} that landed every user on the
 * literal section placeholder {@code "_"}, producing empty task lists
 * even when the seed had created real assignments.</p>
 *
 * <p>Resolution:</p>
 * <ul>
 *   <li>STUDENT → {@code /me/courses}.</li>
 *   <li>PARENT  → {@code /family}.</li>
 *   <li>TENANT_ADMIN / TEACHER → first real {@code Section} (ACTIVE year)
 *       → {@code /lms/sections/{uuid}/assignments}.</li>
 *   <li>No sections → empty state with CTA to Académico.</li>
 * </ul>
 */
@Component({
  selector: 'app-lms-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    EmptyStateComponent,
    IconComponent,
    PageContainerComponent,
    PageHeaderComponent,
    SpinnerComponent,
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header
        eyebrow="Aula virtual"
        title="Aula virtual"
        subtitle="Cargando la sección correspondiente…"
      />

      @if (errorMsg(); as msg) {
        <div class="alert alert-danger mb-4" role="alert">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">No pudimos abrir el aula virtual.</p>
            <p class="mt-1 text-xs opacity-80">{{ msg }}</p>
          </div>
        </div>
      } @else if (loading()) {
        <div class="card">
          <div class="card-body flex items-center gap-3 text-sm text-content-muted">
            <app-spinner [size]="20" />
            <span>Buscando tu primera sección…</span>
          </div>
        </div>
      } @else if (noSections()) {
        <section class="card">
          <div class="card-body space-y-4">
            <app-empty-state
              icon="book-open"
              title="Aún no hay secciones"
              description="El tenant no tiene secciones activas. Crea la primera desde el módulo Académico."
            />
            <a [routerLink]="academicSectionsRoute" class="btn btn-primary btn-sm self-start">
              <app-icon name="plus" [size]="16" />
              <span>Ir a Académico › Secciones</span>
            </a>
          </div>
        </section>
      }
    </app-page-container>
  `,
})
export class LmsLandingComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly academicApi = inject(AcademicApiService);
  private readonly router = inject(Router);

  readonly academicSectionsRoute = ROUTES.ACADEMIC.SECTIONS.LIST;

  readonly loading = signal(true);
  readonly errorMsg = signal<string | null>(null);
  readonly noSections = signal(false);

  async ngOnInit(): Promise<void> {
    const role = this.auth.roles();

    if (role.includes(UserRole.Student)) {
      await this.router.navigateByUrl('/me/courses');
      return;
    }
    if (role.includes(UserRole.Parent)) {
      await this.router.navigateByUrl('/family');
      return;
    }

    try {
      const sections = await firstValueFrom(this.academicApi.listSections());

      const first = sections
        .filter((s) => s.academicYearStatus === 'ACTIVE')
        .sort((a, b) => {
          const ao = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
          const bo = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
          if (ao !== bo) {
            return ao - bo;
          }
          return a.name.localeCompare(b.name);
        })[0];

      if (!first) {
        this.loading.set(false);
        this.noSections.set(true);
        return;
      }

      await this.router.navigateByUrl(ROUTES.LMS.sectionAssignments(first.publicUuid));
    } catch (err) {
      this.loading.set(false);
      const status =
        err instanceof HttpErrorResponse ? `${err.status} ${err.statusText || ''}`.trim() : '';
      this.errorMsg.set(
        status
          ? `Error ${status} al cargar las secciones.`
          : 'No pudimos cargar las secciones.',
      );
    }
  }
}
