import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AdminClaimsService,
  ClaimsAdminState,
} from '@features/admin/services/admin-claims.service';

@Component({
  selector: 'app-admin-claims',
  standalone: true,
  imports: [
    CommonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 py-6 px-4 sm:px-6 lg:px-8">
      <div class="max-w-7xl mx-auto">

        <!-- Header -->
        <div class="rounded-2xl bg-slate-900/80 border border-slate-700/50 p-6 sm:p-8 mb-8">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Reclamos — Libro de Reclamaciones Virtual
              </h1>
              <p class="text-sm text-slate-400 mt-1">
                Lista de reclamos registrados. Respuesta máxima en <strong>15 días hábiles</strong> (Ley N° 32495).
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-500">Página {{ state.currentPage() + 1 }} de {{ state.totalPages() }}</span>
            </div>
          </div>
        </div>

        <!-- Error & Loading -->
        @if (state.errorMessage(); as error) {
        <div class="rounded-2xl bg-slate-900/80 border border-red-500/30 p-6 sm:p-8 mb-8 text-red-300">
          <p class="text-sm">{{ error }}</p>
        </div>
        }

        @if (state.loading(); as loading) {
        <div class="rounded-2xl bg-slate-900/80 border border-slate-700/50 p-6 sm:p-8 mb-8 text-slate-400">
          <p class="text-sm">Cargando reclamos...</p>
        </div>
        }

        @else {
        <div class="mb-4 flex gap-3"><label class="text-xs text-slate-400">Estado<select (change)="setStatus($event)" class="ml-2 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"><option value="">Todos</option><option value="PENDING">Pendiente</option><option value="IN_PROCESS">En proceso</option><option value="ATTENDED">Atendido</option></select></label></div>

        <!-- Claims Table -->
        <div class="overflow-x-auto rounded-2xl bg-slate-900/80 border border-slate-700/50 p-6 sm:p-8">
          <table class="w-full caption-bottom">
            <caption class="text-sm text-slate-400 font-medium mb-4">
              Lista de Reclamos
            </caption>

            <!-- Table Header -->
            <thead class="border-b border-slate-700/50 sticky top-0 bg-slate-950/80">
            <tr class="text-xs text-slate-400">
              <th class="w-32 px-4 py-3 font-medium text-left">Código</th>
              <th class="w-40 px-4 py-3 font-medium text-left">Consumidor</th>
              <th class="w-24 px-4 py-3 font-medium text-left">Tipo</th>
              <th class="w-24 px-4 py-3 font-medium text-left">Estado</th>
              <th class="w-32 px-4 py-3 font-medium text-left">Fecha Límite</th>
              <th class="w-40 px-4 py-3 font-medium text-left">Registrado el</th>
              <th class="w-40 px-4 py-3 font-medium text-left text-right">Acciones</th>
            </tr>
            </thead>

            <!-- Table Body -->
            <tbody>
            @if (state.claims().length === 0) {
            <tr>
              <td class="px-4 py-6 text-center text-slate-500" colspan="7">
                No hay reclamos registrados
              </td>
            </tr>
            } @else {
            @for (claim of state.claims(); track claim.id) {
            <tr class="border-b border-slate-700/30 hover:bg-slate-950/50 transition-colors">
              <td class="px-4 py-3 font-mono text-sm text-slate-200">
                {{ claim.claimCode }}
              </td>
              <td class="px-4 py-3 text-sm text-slate-200">
                {{ claim.consumerName }}
                @if (claim.isMinor) {
                <span class="text-xs text-amber-400 ml-1">(menor)</span>
                }
              </td>
              <td class="px-4 py-3 text-xs font-medium">
                @if (claim.claimType === 'RECLAMO') {
                <span class="text-green-400">RECLAMO</span>
                } @else {
                <span class="text-amber-400">QUEJA</span>
                }
              </td>
              <td class="px-4 py-3 text-xs font-medium">
                @if (claim.status === 'PENDING') {
                <span class="text-yellow-400">PENDIENTE</span>
                } @else if (claim.status === 'IN_PROCESS') {
                <span class="text-amber-400">EN PROCESO</span>
                } @else {
                <span class="text-emerald-400">ATENDIDO</span>
                }
              </td>
              <td class="px-4 py-3 text-sm font-medium text-slate-300">
                {{ claim.dueDate | date:'mediumDate' }}
              </td>
              <td class="px-4 py-3 text-sm text-slate-400">
                {{ claim.createdAt | date:'mediumDate' }}
              </td>
              <td class="px-4 py-3 text-right">
                <button type="button" (click)="respond(claim.id)" [disabled]="claim.status === 'ATTENDED'" class="text-xs text-blue-400 hover:text-blue-300 underline disabled:opacity-40">{{ claim.status === 'ATTENDED' ? 'Atendido' : 'Responder' }}</button>
              </td>
            </tr>
            }
            }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        @if (state.totalPages() > 1) {
        <div class="mt-8 flex justify-between items-center">
          <span class="text-sm text-slate-400">
            Mostrando {{ (state.currentPage() * state.pageSize()) + 1 }}-{{ Math.min(((state.currentPage() + 1) * state.pageSize()), state.totalElements() )}} de {{ state.totalElements() }} reclamos
          </span>

          <div class="flex gap-2">
            <button
              (click)="changePage(state.currentPage() - 1)"
              [disabled]="state.currentPage() === 0"
              class="px-3 py-1 text-xs font-medium text-slate-200 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Anterior
            </button>

            <button
              (click)="changePage(state.currentPage() + 1)"
              [disabled]="state.currentPage() >= state.totalPages() - 1"
              class="px-3 py-1 text-xs font-medium text-slate-200 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
        }
        }
      </div>
    </div>
  `,
})
export class AdminClaimsComponent {
  private readonly claimsService = inject(AdminClaimsService);
  readonly state = inject(ClaimsAdminState);
  readonly Math = Math;
  filterStatus: '' | 'PENDING' | 'IN_PROCESS' | 'ATTENDED' = '';

  constructor() {
    // Cargar la primera página al inicializar
    this.loadClaims();
  }

  /** Cargar reclamos con paginación */
  async loadClaims(params?: {
    status?: 'PENDING' | 'IN_PROCESS' | 'ATTENDED';
    page?: number;
    size?: number;
  }): Promise<void> {
    await this.claimsService.loadClaims({ ...params, status: params?.status ?? (this.filterStatus || undefined), page: params?.page ?? this.state.currentPage() });
  }

  /** Responder a un reclamo */
  async onRespondClaim(claimId: string, responseText: string): Promise<void> {
    await this.claimsService.respondClaim(claimId, responseText);
    await this.loadClaims();
  }

  changePage(page: number): void {
    if (page < 0 || page >= this.state.totalPages()) return;
    void this.loadClaims({ page });
  }

  setStatus(event: Event): void {
    this.filterStatus = (event.target as HTMLSelectElement).value as typeof this.filterStatus;
    void this.loadClaims({ page: 0 });
  }

  async respond(claimId: string): Promise<void> {
    const responseText = window.prompt('Escribe la respuesta formal al reclamo:');
    if (!responseText?.trim()) return;
    try {
      await this.onRespondClaim(claimId, responseText.trim());
    } catch {
      // The service publishes the request error in the page state.
    }
  }
}
