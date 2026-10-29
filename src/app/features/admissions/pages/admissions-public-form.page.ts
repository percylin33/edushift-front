import { createFormProtection } from '@shared/services/form-protection.service';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AdmissionsApiService } from '../services/admissions-api.service';
import { PublicAdmissionCatalog } from '../models';

type InquiryField =
  'contactName' | 'contactValue' | 'academicYearPublicUuid' | 'gradePublicUuid' | 'privacyAccepted';

@Component({
  selector: 'app-public-admissions-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div class="mx-auto max-w-2xl">
        <section
          class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        >
          <header class="bg-indigo-700 px-6 py-7 text-white sm:px-8">
            <p class="text-sm font-semibold text-indigo-100">Admisiones</p>
            <h1 class="mt-1 text-2xl font-bold">
              {{ catalog()?.tenantName || 'Consulta escolar' }}
            </h1>
            <p class="mt-2 max-w-xl text-sm text-indigo-100">
              @if (token()) {
                Continúa tu admisión directamente con el colegio.
              } @else {
                Cuéntanos qué grado te interesa. El colegio se comunicará contigo para orientarte.
              }
            </p>
          </header>

          @if (error()) {
            <div
              role="alert"
              class="mx-6 mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200 sm:mx-8"
            >
              {{ error() }}
            </div>
          }
          @if (notice()) {
            <div
              role="status"
              class="mx-6 mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 sm:mx-8"
            >
              {{ notice() }}
            </div>
          }

          @if (loading()) {
            <div class="p-10 text-center text-sm text-slate-500">Cargando…</div>
          } @else if (token()) {
            <div class="space-y-3 p-6 text-sm text-slate-700 dark:text-slate-200 sm:p-8">
              <h2 class="text-lg font-semibold">No necesitas confirmar por este enlace</h2>
              <p>
                El colegio continúa la admisión y la matrícula directamente. Comunícate con su
                equipo de admisiones o acércate a la institución.
              </p>
            </div>
          } @else if (receipt()) {
            <div class="space-y-4 p-6 sm:p-8">
              <div
                class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                aria-hidden="true"
              >
                ✓
              </div>
              <h2 class="text-center text-xl font-bold text-slate-900 dark:text-white">
                Consulta recibida
              </h2>
              <p class="text-center text-sm text-slate-600 dark:text-slate-300">
                Gracias, {{ form.contactName.trim() }}. El equipo de admisiones se comunicará
                contigo por el medio indicado.
              </p>
              <p class="text-center text-xs text-slate-500">Código de consulta: {{ receipt() }}</p>
            </div>
          } @else {
            @if (catalog(); as available) {
              <form class="space-y-5 p-6 sm:p-8" (ngSubmit)="submit()" novalidate>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  Todos los campos son obligatorios.
                </p>
                <div class="grid gap-4 sm:grid-cols-2">
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-200"
                    >Nombre de la familia
                    <input
                      name="contactName"
                      [(ngModel)]="form.contactName"
                      required
                      maxlength="200"
                      autocomplete="name"
                      [ngClass]="
                        fieldError('contactName')
                          ? 'border-rose-500 dark:border-rose-400'
                          : 'border-slate-300 dark:border-slate-700'
                      "
                      [attr.aria-invalid]="fieldError('contactName') ? 'true' : null"
                      [attr.aria-describedby]="
                        fieldError('contactName') ? 'contactName-error' : null
                      "
                      (blur)="touch('contactName')"
                      class="mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 dark:bg-slate-950 dark:text-white"
                    />
                    @if (fieldError('contactName'); as message) {
                      <p
                        id="contactName-error"
                        class="mt-1 text-sm text-rose-700 dark:text-rose-300"
                        role="alert"
                      >
                        {{ message }}
                      </p>
                    }
                  </label>
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-200"
                    >Celular o teléfono de contacto
                    <input
                      name="contactValue"
                      [(ngModel)]="form.contactValue"
                      required
                      maxlength="32"
                      type="tel"
                      inputmode="tel"
                      autocomplete="tel"
                      placeholder="Ejemplo: 987 654 321"
                      [ngClass]="
                        fieldError('contactValue')
                          ? 'border-rose-500 dark:border-rose-400'
                          : 'border-slate-300 dark:border-slate-700'
                      "
                      [attr.aria-invalid]="fieldError('contactValue') ? 'true' : null"
                      [attr.aria-describedby]="
                        fieldError('contactValue') ? 'contactValue-error' : null
                      "
                      (blur)="touch('contactValue')"
                      class="mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 dark:bg-slate-950 dark:text-white"
                    />
                    @if (fieldError('contactValue'); as message) {
                      <p
                        id="contactValue-error"
                        class="mt-1 text-sm text-rose-700 dark:text-rose-300"
                        role="alert"
                      >
                        {{ message }}
                      </p>
                    }
                  </label>
                </div>
                <div class="grid gap-4 sm:grid-cols-2">
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-200"
                    >Año de interés
                    <select
                      name="academicYearPublicUuid"
                      [(ngModel)]="form.academicYearPublicUuid"
                      required
                      [ngClass]="
                        fieldError('academicYearPublicUuid')
                          ? 'border-rose-500 dark:border-rose-400'
                          : 'border-slate-300 dark:border-slate-700'
                      "
                      [attr.aria-invalid]="fieldError('academicYearPublicUuid') ? 'true' : null"
                      [attr.aria-describedby]="
                        fieldError('academicYearPublicUuid') ? 'academicYearPublicUuid-error' : null
                      "
                      (blur)="touch('academicYearPublicUuid')"
                      class="mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 dark:bg-slate-950 dark:text-white"
                    >
                      <option value="">Selecciona el año</option>
                      @for (year of available.years; track year.publicUuid) {
                        <option [value]="year.publicUuid">{{ year.name }}</option>
                      }
                    </select>
                    @if (fieldError('academicYearPublicUuid'); as message) {
                      <p
                        id="academicYearPublicUuid-error"
                        class="mt-1 text-sm text-rose-700 dark:text-rose-300"
                        role="alert"
                      >
                        {{ message }}
                      </p>
                    }
                  </label>
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-200"
                    >Grado de interés
                    <select
                      name="gradePublicUuid"
                      [(ngModel)]="form.gradePublicUuid"
                      required
                      [ngClass]="
                        fieldError('gradePublicUuid')
                          ? 'border-rose-500 dark:border-rose-400'
                          : 'border-slate-300 dark:border-slate-700'
                      "
                      [attr.aria-invalid]="fieldError('gradePublicUuid') ? 'true' : null"
                      [attr.aria-describedby]="
                        fieldError('gradePublicUuid') ? 'gradePublicUuid-error' : null
                      "
                      (blur)="touch('gradePublicUuid')"
                      class="mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 dark:bg-slate-950 dark:text-white"
                    >
                      <option value="">Selecciona el grado</option>
                      @for (grade of available.grades; track grade.publicUuid) {
                        <option [value]="grade.publicUuid">
                          {{ grade.levelName }} · {{ grade.name }}
                        </option>
                      }
                    </select>
                    @if (fieldError('gradePublicUuid'); as message) {
                      <p
                        id="gradePublicUuid-error"
                        class="mt-1 text-sm text-rose-700 dark:text-rose-300"
                        role="alert"
                      >
                        {{ message }}
                      </p>
                    }
                  </label>
                </div>
                <div>
                  <label class="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <input
                      name="privacyAccepted"
                      type="checkbox"
                      [(ngModel)]="form.privacyAccepted"
                      required
                      [ngClass]="
                        fieldError('privacyAccepted')
                          ? 'border-rose-500 dark:border-rose-400'
                          : 'border-slate-300 dark:border-slate-700'
                      "
                      [attr.aria-invalid]="fieldError('privacyAccepted') ? 'true' : null"
                      [attr.aria-describedby]="
                        fieldError('privacyAccepted') ? 'privacyAccepted-error' : null
                      "
                      (blur)="touch('privacyAccepted')"
                      class="mt-1 h-4 w-4 rounded border text-indigo-600"
                    />
                    <span
                      >Acepto el aviso de privacidad del colegio y el uso de estos datos únicamente
                      para responder esta consulta.</span
                    >
                  </label>
                  @if (fieldError('privacyAccepted'); as message) {
                    <p
                      id="privacyAccepted-error"
                      class="mt-1 text-sm text-rose-700 dark:text-rose-300"
                      role="alert"
                    >
                      {{ message }}
                    </p>
                  }
                </div>
                <label aria-hidden="true" class="absolute -left-[10000px] h-px w-px overflow-hidden"
                  >Sitio web
                  <input
                    name="website"
                    [(ngModel)]="form.website"
                    tabindex="-1"
                    autocomplete="off"
                  />
                </label>
                @if (!available.years.length || !available.grades.length) {
                  <p class="text-sm text-amber-700 dark:text-amber-300">
                    El colegio aún no ha publicado años y grados para recibir consultas.
                  </p>
                }
                <button
                  type="submit"
                  [disabled]="saving() || !available.years.length || !available.grades.length"
                  class="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {{ saving() ? 'Enviando…' : 'Enviar consulta' }}
                </button>
                <p class="text-center text-xs text-slate-500">
                  No pedimos DNI en esta consulta inicial. Si decides postular, el colegio lo
                  solicitará en el proceso formal.
                </p>
              </form>
            }
          }
        </section>
      </div>
    </main>
  `,
})
export class PublicAdmissionsPageComponent {
  protected readonly formProtection = createFormProtection({
    snapshot: () => this.form,
    saving: () => this.saving(),
    active: () => !this.receipt(),
  });

  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly api = inject(AdmissionsApiService);
  readonly tenantSlug = this.route.snapshot.paramMap.get('tenantSlug') ?? '';
  readonly token = signal(this.route.snapshot.paramMap.get('token'));
  readonly catalog = signal<PublicAdmissionCatalog | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly receipt = signal<string | null>(null);
  form = {
    academicYearPublicUuid: '',
    gradePublicUuid: '',
    contactName: '',

    contactValue: '',
    privacyAccepted: false,
    website: '',
  };

  constructor() {
    if (this.token()) {
      this.loading.set(false);
    } else {
      this.api.publicCatalog(this.tenantSlug).subscribe({
        next: (response) => {
          this.catalog.set(response.data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(
            'No se pudo cargar la información del colegio. Verifica el enlace o vuelve a intentarlo.',
          );
          this.loading.set(false);
        },
      });
    }
  }

  readonly attemptedSubmit = signal(false);
  private readonly touchedFields = signal<ReadonlySet<InquiryField>>(new Set());
  private readonly requiredFields: InquiryField[] = [
    'contactName',
    'contactValue',
    'academicYearPublicUuid',
    'gradePublicUuid',
    'privacyAccepted',
  ];

  touch(field: InquiryField): void {
    this.touchedFields.update((fields) => new Set([...fields, field]));
  }

  fieldError(field: InquiryField): string | null {
    if (!this.attemptedSubmit() && !this.touchedFields().has(field)) return null;
    return this.validationError(field);
  }

  private validationError(field: InquiryField): string | null {
    switch (field) {
      case 'contactName':
        if (!this.form.contactName.trim()) return 'Falta el nombre de la familia.';
        return this.form.contactName.trim().length > 200
          ? 'El nombre debe tener como máximo 200 caracteres.'
          : null;
      case 'contactValue': {
        const phone = this.form.contactValue.trim();
        if (!phone) return 'Falta el celular o teléfono de contacto.';
        const digits = phone.replace(/\D/g, '').length;
        return /^[+0-9()\-\s]{7,32}$/.test(phone) && digits >= 7 && digits <= 15
          ? null
          : 'Ingresa un teléfono válido de 7 a 15 dígitos. Puedes incluir el código de país.';
      }
      case 'academicYearPublicUuid':
        return this.form.academicYearPublicUuid ? null : 'Selecciona el año de interés.';
      case 'gradePublicUuid':
        return this.form.gradePublicUuid ? null : 'Selecciona el grado de interés.';
      case 'privacyAccepted':
        return this.form.privacyAccepted
          ? null
          : 'Acepta el aviso de privacidad para enviar la consulta.';
    }
  }

  submit(): void {
    if (this.saving()) return;
    this.attemptedSubmit.set(true);
    const firstInvalid = this.requiredFields.find((field) => this.validationError(field));
    if (firstInvalid) {
      this.error.set('Completa o corrige los campos marcados para enviar tu consulta.');
      this.host.nativeElement.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.api
      .submitPublicInquiry(this.tenantSlug, {
        ...this.form,
        contactType: 'PHONE',
        contactName: this.form.contactName.trim(),
        contactValue: this.form.contactValue.trim(),
      })
      .subscribe({
        next: (response) => {
          this.receipt.set(response.data.reference);
          this.notice.set('Consulta registrada.');
          this.saving.set(false);
        },
        error: () => {
          this.error.set('No se pudo enviar la consulta. Revisa los datos y vuelve a intentarlo.');
          this.saving.set(false);
        },
      });
  }
}
