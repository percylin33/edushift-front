import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { Permission } from '@core/enums';
import { AuthService } from '@core/services';
import { PageContainerComponent, PageHeaderComponent } from '@shared/components';
import { AgentChatService, AiCapabilities } from '../../services/agent-chat.service';

@Component({
  selector: 'app-ai-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageContainerComponent, PageHeaderComponent],
  template: `
    <app-page-container size="narrow">
      <app-page-header title="Asistentes IA"
        subtitle="Apoyo para estudiantes, docentes y familias." />
      @if (loading()) {
        <p class="text-sm text-slate-600 dark:text-slate-300">Cargando acceso del colegio…</p>
      } @else if (error()) {
        <p role="alert" class="text-sm text-rose-600">{{ error() }}</p>
      } @else {
      @if (capabilities(); as access) {
        <div class="mb-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <p class="font-semibold">Plan {{ access.planCode || 'no disponible' }}</p>
          <p class="text-sm text-slate-600 dark:text-slate-300">
            {{ access.requestsRemainingToday }} solicitudes disponibles hoy ·
            {{ access.tokensRemainingThisMonth }} tokens disponibles este mes
          </p>
          @if (!access.aiEnabled && access.blockedReason !== 'AI_PLAN_UNAVAILABLE') {
            <p class="mt-2 text-sm">La IA está desactivada para este colegio.</p>
          }
          @if (access.blockedReason === 'AI_QUOTA_EXCEEDED') {
            <p class="mt-2 text-sm">Se agotó la cuota del plan. Consulta la fecha de reinicio.</p>
          }
          @if (access.blockedReason === 'AI_PLAN_UNAVAILABLE') {
            <p class="mt-2 text-sm">El plan o suscripción del colegio no permite usar IA ahora.</p>
          }
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          @if (access.assistants.TUTOR) {
            <a [routerLink]="routes.TUTOR" class="card p-5 hover:ring-2 hover:ring-indigo-500">
              <h2 class="font-semibold">Tutor de refuerzo</h2>
              <p class="mt-1 text-sm">Explicaciones, pistas y práctica adaptada.</p>
            </a>
          }
          @if (access.assistants.TEACHER) {
            <a [routerLink]="routes.TEACHER" class="card p-5 hover:ring-2 hover:ring-indigo-500">
              <h2 class="font-semibold">Apoyo al docente</h2>
              <p class="mt-1 text-sm">Borradores de sesiones, fichas y rúbricas.</p>
            </a>
          }
          @if (access.assistants.FAMILY) {
            <a [routerLink]="routes.FAMILY" class="card p-5 hover:ring-2 hover:ring-indigo-500">
              <h2 class="font-semibold">Informador familiar</h2>
              <p class="mt-1 text-sm">Documentos del colegio y datos de tu hijo.</p>
            </a>
          }
        </div>
        @if (canManageSources()) {
          <a routerLink="/ai/sources" class="mt-5 inline-block text-sm text-indigo-600 underline">
            Administrar fuentes RAG
          </a>
        }
        @if (!access.assistants.TUTOR && !access.assistants.TEACHER
              && !access.assistants.FAMILY) {
          <p class="text-sm text-slate-600 dark:text-slate-300">
            Tu plan o tu perfil aún no tiene un asistente disponible.
          </p>
        }
      }
      }
    </app-page-container>
  `,
})
export class AiHomeComponent implements OnInit {
  private readonly agents = inject(AgentChatService);
  private readonly auth = inject(AuthService);
  readonly routes = ROUTES.AI;
  readonly capabilities = signal<AiCapabilities | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly canManageSources = () => this.auth.hasPermission(Permission.AiSourceManage);

  async ngOnInit(): Promise<void> {
    try {
      this.capabilities.set(await firstValueFrom(this.agents.capabilities()));
    } catch {
      this.error.set('No se pudo consultar el acceso a IA del colegio.');
    } finally {
      this.loading.set(false);
    }
  }
}
