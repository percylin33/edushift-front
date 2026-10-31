import { SafeBackdropDirective } from '@shared/directives/safe-backdrop.directive';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { UsersApiService } from '@features/users/services';
import { UserRow } from '@features/users/models';
import { TeachersStore } from '../store';
import { TeacherDetail } from '../models';

/**
 * Dialog "Vincular a usuario existente" — segundo path (después de
 * "Invitar al sistema") para que un docente termine con
 * {@code userPublicUuid} seteado.
 *
 * <h3>Flow</h3>
 * <ol>
 *   <li>El dialog carga las cuentas de la institución, incluso si todavía
 *       no tienen el rol de docente.</li>
 *   <li>Búsqueda client-side por nombre/email mientras el admin
 *       tipea (instantáneo, sin debouncing — listas chicas).</li>
 *   <li>Click en un user dispara
 *       {@link TeachersStore#linkUser}.</li>
 * </ol>
 *
 * <h3>Errores</h3>
 * El backend asigna TEACHER y vincula la ficha en una transacción.
 * Los conflictos se muestran en un banner local:
 * <ul>
 *   <li>{@code TEACHER_ALREADY_HAS_USER}</li>
 *   <li>{@code USER_ALREADY_LINKED_TO_TEACHER}</li>
 * </ul>
 *
 * <h3>Decisiones</h3>
 * Si la lista crece >100 entries,
 * agregaremos un parámetro de búsqueda al backend en sprint
 * posterior.
 */
@Component({
  selector: 'app-link-user-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SafeBackdropDirective, CommonModule, FormsModule, IconComponent, SpinnerComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-user-title"
      appSafeBackdrop (click)="onBackdropClick($event)"
    >
      <div
        class="card flex max-h-[80vh] w-full max-w-2xl flex-col shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <header class="card-header">
          <div>
            <h2 id="link-user-title" class="card-title">Vincular a usuario existente</h2>
            <p class="card-description">
              Selecciona la cuenta que quieres vincular a {{ teacher().fullName }}. Al vincularla,
              se le asignará el acceso de Profesor.
            </p>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-icon"
            aria-label="Cerrar"
            (click)="close()"
          >
            <app-icon name="x" [size]="18" />
          </button>
        </header>

        <div class="card-body flex flex-col gap-3 overflow-hidden">
          @if (errorMessage(); as err) {
            <div class="alert alert-danger">
              <app-icon name="alert-circle" [size]="18" />
              <p class="flex-1 text-sm">{{ err }}</p>
            </div>
          }

          <div class="field">
            <label class="label" for="link-user-search">Buscar</label>
            <div class="relative">
              <span
                class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-content-subtle"
              >
                <app-icon name="search" [size]="16" />
              </span>
              <input
                id="link-user-search"
                type="search"
                class="input pl-9"
                placeholder="Nombre o email…"
                [ngModel]="search()"
                (ngModelChange)="search.set($event)"
              />
            </div>
          </div>

          <div class="-mx-5 overflow-y-auto px-5">
            @if (loading()) {
              <div class="flex items-center justify-center py-10">
                <app-spinner [size]="24" label="Cargando usuarios…" />
              </div>
            } @else if (filtered().length === 0) {
              <p class="py-8 text-center text-sm text-content-muted">
                @if (search()) {
                  No hay usuarios que coincidan con "<strong>{{ search() }}</strong
                  >".
                } @else {
                  No hay cuentas disponibles en esta institución.
                }
              </p>
            } @else {
              <ul class="divide-y divide-border-subtle">
                @for (u of filtered(); track u.publicUuid) {
                  <li>
                    <button
                      type="button"
                      class="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-surface-muted disabled:opacity-50"
                      [disabled]="linking()"
                      (click)="onSelect(u)"
                    >
                      <div class="min-w-0 flex-1">
                        <p class="truncate font-medium text-content">
                          {{ u.fullName }}
                        </p>
                        <p class="truncate text-xs text-content-muted">{{ u.email }}</p>
                      </div>
                      <app-icon name="chevron-right" [size]="16" />
                    </button>
                  </li>
                }
              </ul>
            }
          </div>
        </div>

        <footer class="card-footer">
          <p class="flex-1 text-xs text-content-muted">
            Si la persona aún no tiene cuenta, usa <strong>Invitar al sistema</strong> desde esta
            ficha.
          </p>
          <button type="button" class="btn btn-ghost btn-sm" (click)="close()">Cancelar</button>
        </footer>
      </div>
    </div>
  `,
})
export class LinkUserDialogComponent implements OnInit {
  private readonly usersApi = inject(UsersApiService);
  private readonly store = inject(TeachersStore);

  readonly teacher = input.required<TeacherDetail>();

  readonly closed = output<void>();
  readonly linked = output<void>();

  protected readonly users = signal<UserRow[]>([]);
  protected readonly search = signal<string>('');
  protected readonly loading = signal<boolean>(false);
  protected readonly linking = this.store.saving;
  protected readonly errorMessage = this.store.error;

  protected readonly filtered = computed<UserRow[]>(() => {
    const q = this.search().trim().toLowerCase();
    const all = this.users();
    if (!q) return all;
    return all.filter(
      (u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  });

  async ngOnInit(): Promise<void> {
    this.store.clearError();
    await this.fetchUsers();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  protected close(): void {
    this.store.clearError();
    this.closed.emit();
  }

  protected async onSelect(user: UserRow): Promise<void> {
    if (this.linking()) return;
    const result = await this.store.linkUser(this.teacher().publicUuid, {
      userPublicUuid: user.publicUuid,
    });
    if (result) this.linked.emit();
  }

  private async fetchUsers(): Promise<void> {
    this.loading.set(true);
    try {
      /* Tomamos un cap razonable (100). Si el tenant tiene más
       * cuentas, en sprint posterior agregamos paginación
       * o un endpoint con filtro {@code linkedToTeacher=false}. */
      const page = await firstValueFrom(
        this.usersApi.list(
          {},
          { page: 0, size: 100, sort: 'lastName,ASC' },
        ),
      );
      this.users.set(page.content);
    } catch {
      /* Banner del store ya cubre el resto; mantenemos el dialog
       * usable mostrando lista vacía + el banner. */
      this.users.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}
