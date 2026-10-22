import { createFormProtection } from '@shared/services/form-protection.service';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { API } from '@core/constants';
import { AlertComponent, FormFieldComponent, SpinnerComponent, SubmitButtonComponent } from '@shared/components';

export interface ClaimIssuedResponse {
  id: string;
  claimCode: string;
  consumerName: string;
  consumerDocType: string;
  consumerDocNumber: string;
  consumerEmail: string;
  consumerPhone: string;
  consumerAddress: string;
  isMinor: boolean;
  parentGuardianName: string | null;
  contractedService: string;
  claimAmount: number | null;
  claimType: 'RECLAMO' | 'QUEJA';
  detailDescription: string;
  consumerRequest: string;
  dueDate: string;
  createdAt: string;
}

@Component({
  selector: 'app-claims-book',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    AlertComponent,
    FormFieldComponent,
    SpinnerComponent,
    SubmitButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-900 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-3xl mx-auto space-y-8">
        
        <!-- Header -->
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-950/40 via-slate-800 to-slate-900 p-6 sm:p-8 border border-slate-700/60 shadow-2xl backdrop-blur-md">
          <div class="flex items-center justify-between gap-4 flex-wrap">
            <div class="space-y-2">
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Ley N° 32495 — INDECOPI (Perú)
              </div>
              <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Libro de Reclamaciones Virtual
              </h1>
              <p class="text-xs sm:text-sm text-slate-400">
                Conforme al Código de Protección y Defensa del Consumidor. Respuesta máxima en <strong>15 días hábiles</strong>.
              </p>
            </div>
            <a
              routerLink="/auth/login"
              class="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-600 transition-colors shadow-sm"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Ir al inicio
            </a>
          </div>
        </div>

        @if (issuedClaim(); as claim) {
          <!-- Hoja de Reclamación Emitida (Exito) -->
          <div class="rounded-2xl bg-slate-800/80 border border-emerald-500/30 p-6 sm:p-8 space-y-6 text-slate-200">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xl">
                ✓
              </div>
              <div>
                <h2 class="text-xl font-bold text-white">Hoja de Reclamación Registrada</h2>
                <p class="text-xs text-slate-400">Se registró tu hoja. Guarda el código y descarga una copia para tus archivos.</p>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-700/60 text-xs">
              <div>
                <span class="text-slate-400 block">Código Correlativo:</span>
                <span class="font-mono text-base font-bold text-emerald-400">{{ claim.claimCode }}</span>
              </div>
              <div>
                <span class="text-slate-400 block">Tipo de Registro:</span>
                <span class="font-semibold text-white">{{ claim.claimType }}</span>
              </div>
              <div>
                <span class="text-slate-400 block">Consumidor Reclamante:</span>
                <span class="font-semibold text-slate-200">{{ claim.consumerName }}</span>
              </div>
              <div>
                <span class="text-slate-400 block">Fecha Límite de Atención (15 días hábiles):</span>
                <span class="font-bold text-amber-400">{{ claim.dueDate }}</span>
              </div>
            </div>

            <div class="claim-print rounded-xl border border-slate-700/60 bg-slate-900/40 p-5 text-xs leading-6">
              <h3 class="mb-3 text-sm font-bold text-white">Copia de tu Hoja de Reclamación</h3>
                <p><strong>Proveedor:</strong> EduShift — razón social, RUC y domicilio pendientes de completar.</p>
              <p><strong>Consumidor:</strong> {{ claim.consumerName }}</p>
              <p><strong>Documento:</strong> {{ claim.consumerDocType }} · {{ claim.consumerDocNumber }}</p>
              @if (claim.isMinor && claim.parentGuardianName) {
                <p><strong>Representante:</strong> {{ claim.parentGuardianName }}</p>
              }
              <p><strong>Correo:</strong> {{ claim.consumerEmail }} · <strong>Teléfono:</strong> {{ claim.consumerPhone }}</p>
              <p><strong>Domicilio:</strong> {{ claim.consumerAddress }}</p>
              <p><strong>Servicio:</strong> {{ claim.contractedService }} @if (claim.claimAmount !== null) { <span>· <strong>Monto:</strong> S/ {{ claim.claimAmount | number:'1.2-2' }}</span> }</p>
              <p><strong>Tipo:</strong> {{ claim.claimType === 'RECLAMO' ? 'Reclamo' : 'Queja' }}</p>
              <p><strong>Detalle:</strong> {{ claim.detailDescription }}</p>
              <p><strong>Pedido:</strong> {{ claim.consumerRequest }}</p>
              <p><strong>Fecha de registro:</strong> {{ claim.createdAt | date:'dd/MM/yyyy' }}</p>
              <p><strong>Código de seguimiento:</strong> {{ claim.claimCode }}</p>
              <p><strong>Fecha máxima de respuesta:</strong> {{ claim.dueDate | date:'dd/MM/yyyy' }}</p>
            </div>

            <div class="flex flex-wrap justify-end gap-3 pt-2 print:hidden">
              <button
                type="button"
                (click)="printCopy()"
                class="px-4 py-2 text-xs font-semibold bg-indigo-700 hover:bg-indigo-600 rounded-lg text-white transition-colors"
              >
                Imprimir o guardar copia
              </button>
              <button
                type="button"
                (click)="resetForm()"
                class="px-4 py-2 text-xs font-semibold bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
              >
                Registrar otro reclamo
              </button>
            </div>
          </div>
        } @else {
          <!-- Formulario de Registro -->
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="bg-slate-800/40 rounded-2xl border border-slate-700/50 p-6 sm:p-8 space-y-6">
            
            @if (errorMessage(); as msg) {
              <app-alert variant="error" [message]="msg" />
            }

            <!-- 1. Identificación del Consumidor -->
            <div class="space-y-4">
              <h3 class="text-sm font-bold text-white border-b border-slate-700 pb-2 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-red-500"></span>
                1. Identificación del Consumidor Reclamante
              </h3>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="sm:col-span-2">
                  <app-form-field
                    fieldId="consumerName"
                    [control]="getCtrl('consumerName')"
                    label="Nombres y Apellidos Completos *"
                    placeholder="Ej. Juan Carlos Pérez López"
                  />
                </div>

                <div>
                  <label class="block text-xs font-medium text-slate-300 mb-1">Tipo de Documento *</label>
                  <select
                    formControlName="consumerDocType"
                    class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="DNI">DNI (Documento Nacional de Identidad)</option>
                    <option value="CE">Carné de Extranjería</option>
                    <option value="RUC">RUC</option>
                    <option value="PASAPORTE">Pasaporte</option>
                  </select>
                </div>

                <div>
                  <app-form-field
                    fieldId="consumerDocNumber"
                    [control]="getCtrl('consumerDocNumber')"
                    label="Número de Documento *"
                    placeholder="72819203"
                  />
                </div>

                <div>
                  <app-form-field
                    fieldId="consumerEmail"
                    [control]="getCtrl('consumerEmail')"
                    label="Correo Electrónico de Contacto *"
                    type="email"
                    placeholder="juan.perez@email.com"
                  />
                </div>

                <div>
                  <app-form-field
                    fieldId="consumerPhone"
                    [control]="getCtrl('consumerPhone')"
                    label="Teléfono / Celular *"
                    placeholder="987654321"
                  />
                </div>

                <div class="sm:col-span-2">
                  <app-form-field
                    fieldId="consumerAddress"
                    [control]="getCtrl('consumerAddress')"
                    label="Dirección Domiciliaria *"
                    placeholder="Av. Las Flores 123, Lima"
                  />
                </div>

                <div class="sm:col-span-2 space-y-2">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      formControlName="isMinor"
                      class="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
                    />
                    <span class="text-xs text-slate-300">El reclamo es presentado por un padre/madre en representación de un menor de edad</span>
                  </label>

                  @if (form.get('isMinor')?.value) {
                    <app-form-field
                      fieldId="parentGuardianName"
                      [control]="getCtrl('parentGuardianName')"
                      label="Nombres y Apellidos del Apoderado / Padre"
                      placeholder="Nombre del apoderado legal"
                    />
                  }
                </div>
              </div>
            </div>

            <!-- 2. Identificación del Bien o Servicio -->
            <div class="space-y-4 pt-2">
              <h3 class="text-sm font-bold text-white border-b border-slate-700 pb-2 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-red-500"></span>
                2. Identificación del Bien o Servicio Contratado
              </h3>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <app-form-field
                    fieldId="contractedService"
                    [control]="getCtrl('contractedService')"
                    label="Servicio o Producto Contratado *"
                    placeholder="Plataforma EduShift / Servicio Escolar"
                  />
                </div>

                <div>
                  <app-form-field
                    fieldId="claimAmount"
                    [control]="getCtrl('claimAmount')"
                    label="Monto Reclamado S/ (Opcional)"
                    type="number"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <!-- 3. Detalle de Reclamación o Queja -->
            <div class="space-y-4 pt-2">
              <h3 class="text-sm font-bold text-white border-b border-slate-700 pb-2 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-red-500"></span>
                3. Detalle de la Reclamación y Pedido Concreto
              </h3>

              <div>
                <label class="block text-xs font-medium text-slate-300 mb-2">Tipo de Registro *</label>
                <div class="grid grid-cols-2 gap-4">
                  <label
                    class="p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-1"
                    [ngClass]="form.get('claimType')?.value === 'RECLAMO' ? 'border-red-500 bg-red-500/10 text-white' : 'border-slate-700 bg-slate-900 text-slate-400'"
                  >
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-xs">RECLAMO</span>
                      <input type="radio" formControlName="claimType" value="RECLAMO" class="hidden" />
                    </div>
                    <span class="text-[11px] text-slate-400">Disconformidad relacionada a los servicios o productos contratados.</span>
                  </label>

                  <label
                    class="p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-1"
                    [ngClass]="form.get('claimType')?.value === 'QUEJA' ? 'border-amber-500 bg-amber-500/10 text-white' : 'border-slate-700 bg-slate-900 text-slate-400'"
                  >
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-xs">QUEJA</span>
                      <input type="radio" formControlName="claimType" value="QUEJA" class="hidden" />
                    </div>
                    <span class="text-[11px] text-slate-400">Disconformidad no relacionada directamente a los bienes (atención, malestar).</span>
                  </label>
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-300 mb-1">Detalle del Reclamo o Queja *</label>
                <textarea
                  formControlName="detailDescription"
                  rows="4"
                  class="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-slate-200 focus:border-blue-500 focus:outline-none placeholder-slate-500"
                  placeholder="Explique con detalle los hechos ocurridos..."
                ></textarea>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-300 mb-1">Pedido o Solicitud Concreta *</label>
                <textarea
                  formControlName="consumerRequest"
                  rows="3"
                  class="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-slate-200 focus:border-blue-500 focus:outline-none placeholder-slate-500"
                  placeholder="Detalle la solución o rectificación esperada..."
                ></textarea>
              </div>
            </div>

            <!-- Submit -->
            <p class="text-xs leading-5 text-slate-400">Los datos que envíes se usarán para registrar y atender este reclamo o queja. Consulta los detalles en la <a routerLink="/politica-privacidad" class="font-semibold text-indigo-300 underline">Política de Privacidad</a>.</p>
            <div class="pt-4 flex justify-end print:hidden">
              <app-submit-button
                [loading]="loading()"
                label="Enviar Hoja de Reclamación"
                loadingLabel="Emitiendo..."
              />
            </div>
          </form>
        }

      </div>
    </div>
  `,
})
export class ClaimsBookComponent {
  protected readonly formProtection = createFormProtection({
    snapshot: () => this.form.getRawValue(),
    saving: () => this.loading(),
    active: () => !this.issuedClaim(),
  });

  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly issuedClaim = signal<ClaimIssuedResponse | null>(null);

  printCopy(): void {
    window.print();
  }

  readonly form: FormGroup = this.fb.nonNullable.group({
    consumerName: ['', [Validators.required, Validators.maxLength(200)]],
    consumerDocType: ['DNI', [Validators.required]],
    consumerDocNumber: ['', [Validators.required, Validators.maxLength(20)]],
    consumerEmail: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    consumerPhone: ['', [Validators.required, Validators.maxLength(32)]],
    consumerAddress: ['', [Validators.required, Validators.maxLength(300)]],
    isMinor: [false],
    parentGuardianName: [''],
    contractedService: ['Plataforma EduShift SaaS', [Validators.required]],
    claimAmount: [null],
    claimType: ['RECLAMO', [Validators.required]],
    detailDescription: ['', [Validators.required, Validators.minLength(10)]],
    consumerRequest: ['', [Validators.required, Validators.minLength(5)]],
  });

  getCtrl(name: string) {
    return this.form.get(name) as any;
  }

  resetForm(): void {
    this.issuedClaim.set(null);
    this.form.reset({
      consumerDocType: 'DNI',
      isMinor: false,
      contractedService: 'Plataforma EduShift SaaS',
      claimType: 'RECLAMO',
    });
  }

  onSubmit(): void {
    if (this.loading()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Por favor completa todos los campos obligatorios (*).');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();

    this.http.post<any>(`${API.BASE}/public/claims`, raw).subscribe({
      next: (res) => {
        this.loading.set(false);
        const claim = res.data || res;
        this.issuedClaim.set({
          id: claim.id,
          claimCode: claim.claimCode,
          consumerName: claim.consumerName,
          consumerDocType: claim.consumerDocType,
          consumerDocNumber: claim.consumerDocNumber,
          consumerEmail: claim.consumerEmail,
          consumerPhone: claim.consumerPhone,
          consumerAddress: claim.consumerAddress,
          isMinor: claim.isMinor,
          parentGuardianName: claim.parentGuardianName,
          contractedService: claim.contractedService,
          claimAmount: claim.claimAmount,
          claimType: claim.claimType,
          detailDescription: claim.detailDescription,
          consumerRequest: claim.consumerRequest,
          dueDate: claim.dueDate,
          createdAt: claim.createdAt,
        });
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('No se pudo enviar la reclamación. Intente nuevamente.');
      },
    });
  }
}
