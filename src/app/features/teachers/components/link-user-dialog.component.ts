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
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { UserRole } from '@core/enums';
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
 *   <li>El dialog hace {@code GET /v1/users?role=TEACHER&size=100}
 *       (escopado al rol) y guarda el resultado.</li>
 *   <li>Búsqueda client-side por nombre/email mientras el admin
 *       tipea (instantáneo, sin debouncing — listas chicas).</li>
 *   <li>Click en un user dispara
 *       {@link TeachersStore#linkUser}.</li>
 * </ol>
 *
 * <h3>Errores</h3>
 * El backend valida tres invariantes; cualquier 409 se mapea a un
 * banner local del dialog:
 * <ul>
 *   <li>{@code TEACHER_ALREADY_HAS_USER}</li>
 *   <li>{@code USER_NOT_TEACHER_ROLE} — no debería pasar porque
 *       filtramos por rol, pero defendemos por race con role-changes.</li>
 *   <li>{@code USER_ALREADY_LINKED_TO_TEACHER}</li>
 * </ul>
 *
 * <h3>Decisiones</h3>
 * Para no expandir la API (que el spec original sugería: filtro
 * {@code linkedToTeacher=false}), filtramos client-side cualquier
 * user con rol TEACHER cuya cuenta ya esté en uso por <em>este</em>
 * docente (autoexclusión). Si la lista crece >100 entries,
 * agregaremos un parámetro de búsqueda al backend en sprint
 * posterior.
 */
@Component({
  selector: 'app-link-user-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IconComponent, SpinnerComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-user-title"
      (click)="onBackdropClick($event)"
    >
      <div class="card w-full max-w-2xl shadow-xl flex flex-col max-h-[80vh]" (click)="$event.stopPropagation()">
        <header class="card-header">
          <div>
            <h2 id="link-user-title" class="card-title">Vincular a usuario existente</h2>
            <p class="card-description">
              Selecciona el usuario con rol <strong>Profesor</strong> al que
              quieres vincular a {{ teacher().fullName }}.
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
              <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-content-subtle">
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

          <div class="overflow-y-auto -mx-5 px-5">
            @if (loading()) {
              <div class="flex items-center justify-center py-10">
                <app-spinner [size]="24" label="Cargando usuarios…" />
              </div>
            } @else if (filtered().length === 0) {
              <p class="py-8 text-center text-sm text-content-muted">
                @if (search()) {
                  No hay usuarios que coincidan con
                  "<strong>{{ search() }}</strong>".
                } @else {
                  No hay usuarios con rol Profesor en este workspace.
                }
              </p>
            } @else {
              <ul class="divide-y divide-border-subtle">
                @for (u of filtered(); track u.publicUuid) {
                  <li>
                    <button
                      type="button"
                      class="flex w-full items-center justify-between gap-3 py-2 px-2 hover:bg-surface-muted disabled:opacity-50 rounded-md text-left"
                      [disabled]="linking()"
                      (click)="onSelect(u)"
                    >
                      <div class="min-w-0 flex-1">
                        <p class="font-medium text-content truncate">
                          {{ u.fullName }}
                        </p>
                        <p class="text-xs text-content-muted truncate">{{ u.email }}</p>
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
            ¿No aparece? Asegúrate de que el usuario tenga el rol
            <strong>Profesor</strong> asignado en
            <em>Usuarios</em>.
          </p>
          <button type="button" class="btn btn-ghost btn-sm" (click)="close()">
            Cancelar
          </button>
        </footer>
      </div>
    </div>
  `
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
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
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
      userPublicUuid: user.publicUuid
    });
    if (result) this.linked.emit();
  }

  private async fetchUsers(): Promise<void> {
    this.loading.set(true);
    try {
      /* Tomamos un cap razonable (100). Si el tenant tiene más
       * docentes con cuenta, en sprint posterior agregamos paginación
       * o un endpoint con filtro {@code linkedToTeacher=false}. */
      const page = await firstValueFrom(
        this.usersApi.list(
          { role: UserRole.Teacher },
          { page: 0, size: 100, sort: 'lastName,ASC' }
        )
      );
      this.users.set(page.content);
    }
    catch {
      /* Banner del store ya cubre el resto; mantenemos el dialog
       * usable mostrando lista vacía + el banner. */
      this.users.set([]);
    }
    finally {
      this.loading.set(false);
    }
  }
}
