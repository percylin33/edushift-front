import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminPlansService } from '../../services';

@Component({
  selector: 'app-admin-plans',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Planes</h1>
          <p class="mt-1 text-sm text-slate-400">Catálogo de planes de suscripción.</p>
        </div>
        <button
          (click)="openNew()"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          + Nuevo plan
        </button>
      </div>

      @if (svc.error(); as err) {
        <div class="mt-4 rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">{{ err }}</div>
      }

      <div class="mt-4 overflow-x-auto rounded-xl border border-slate-800">
        <table class="w-full text-sm">
          <thead class="bg-slate-900 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th class="px-4 py-3">Nombre</th>
              <th class="px-4 py-3">Código</th>
              <th class="px-4 py-3">Precio/est</th>
              <th class="px-4 py-3">Max estudiantes</th>
              <th class="px-4 py-3">Features</th>
              <th class="px-4 py-3">Activo</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800">
            @for (p of svc.plans(); track p.publicUuid) {
              <tr class="hover:bg-slate-800/50">
                <td class="px-4 py-3 font-medium text-white">{{ p.name }}</td>
                <td class="px-4 py-3 text-slate-400">{{ p.code }}</td>
                <td class="px-4 py-3 text-slate-300">S/ {{ (p.pricePerStudentCents / 100).toFixed(2) }}</td>
                <td class="px-4 py-3 text-slate-300">{{ p.maxStudents ?? '∞' }}</td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1">
                    @for (f of p.features; track f) {
                      <span class="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{{ f }}</span>
                    }
                  </div>
                </td>
                <td class="px-4 py-3">
                  @if (p.isActive) {
                    <span class="rounded-full bg-emerald-900/50 px-2 py-0.5 text-xs text-emerald-300">Activo</span>
                  } @else {
                    <span class="rounded-full bg-red-900/50 px-2 py-0.5 text-xs text-red-300">Inactivo</span>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="px-4 py-8 text-center text-slate-500">
                  {{ svc.loading() ? 'Cargando…' : 'No hay planes registrados.' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (showForm()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div class="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <h2 class="text-lg font-bold text-white">Nuevo plan</h2>

            <div class="mt-4 space-y-4">
              <div>
                <label class="mb-1 block text-sm text-slate-400">Nombre</label>
                <input [(ngModel)]="formName" class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label class="mb-1 block text-sm text-slate-400">Código</label>
                <input [(ngModel)]="formCode" class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label class="mb-1 block text-sm text-slate-400">Precio por estudiante (céntimos)</label>
                <input type="number" [(ngModel)]="formPrice" class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label class="mb-1 block text-sm text-slate-400">Max estudiantes (0 = ilimitado)</label>
                <input type="number" [(ngModel)]="formMaxStudents" class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
              </div>
            </div>

            <div class="mt-6 flex justify-end gap-3">
              <button (click)="showForm.set(false)" class="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
                Cancelar
              </button>
              <button (click)="save()" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500">
                Guardar
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AdminPlansComponent implements OnInit {
  protected readonly svc = inject(AdminPlansService);

  protected readonly showForm = signal(false);
  protected formName = '';
  protected formCode = '';
  protected formPrice = 0;
  protected formMaxStudents = 0;

  ngOnInit(): void {
    this.svc.loadPlans();
  }

  protected openNew(): void {
    this.formName = '';
    this.formCode = '';
    this.formPrice = 0;
    this.formMaxStudents = 0;
    this.showForm.set(true);
  }

  protected save(): void {
    this.svc.createPlan({
      name: this.formName,
      code: this.formCode,
      pricePerStudentCents: this.formPrice,
      maxStudents: this.formMaxStudents || undefined,
      features: [],
    });
    this.showForm.set(false);
  }
}
