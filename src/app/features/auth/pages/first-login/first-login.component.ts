import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { AuthService } from '@core/services';
import { SpinnerComponent } from '@shared/components';
import { AuthApiService, OnboardingMe } from '../../services/auth-api.service';

/**
 * CRED-7 — role-aware first-login: password + light profile (email optional).
 */
@Component({
  selector: 'app-first-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, SpinnerComponent],
  template: `
    <div class="mx-auto w-full max-w-md space-y-6 py-8">
      <div class="space-y-2 text-center">
        <h1 class="text-2xl font-semibold text-content">Completa tu acceso</h1>
        <p class="text-sm text-content-muted">
          Cambia la contraseña temporal y confirma tus datos de contacto.
          @if (role() === 'STUDENT') {
            Perfil de alumno.
          } @else if (role() === 'PARENT') {
            Perfil de tutor / apoderado.
          }
        </p>
      </div>

      @if (errorMessage()) {
        <div class="alert alert-danger text-sm">{{ errorMessage() }}</div>
      }

      @if (loading()) {
        <div class="flex justify-center py-8">
          <app-spinner [size]="24" />
        </div>
      } @else {
        <form class="card space-y-4 p-6" [formGroup]="form" (ngSubmit)="submit()">
          <div class="space-y-1">
            <label class="text-xs font-medium text-content" for="currentPassword">
              Contraseña temporal
            </label>
            <input
              id="currentPassword"
              type="password"
              class="input w-full"
              formControlName="currentPassword"
              autocomplete="current-password"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-medium text-content" for="newPassword">Nueva contraseña</label>
            <input
              id="newPassword"
              type="password"
              class="input w-full"
              formControlName="newPassword"
              autocomplete="new-password"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-medium text-content" for="confirmPassword">
              Confirmar contraseña
            </label>
            <input
              id="confirmPassword"
              type="password"
              class="input w-full"
              formControlName="confirmPassword"
              autocomplete="new-password"
            />
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="space-y-1">
              <label class="text-xs font-medium text-content" for="firstName">
                Nombres
                @if (isRequired('firstName')) {
                  <span class="text-danger">*</span>
                }
              </label>
              <input id="firstName" type="text" class="input w-full" formControlName="firstName" />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-medium text-content" for="lastName">
                Apellidos
                @if (isRequired('lastName')) {
                  <span class="text-danger">*</span>
                }
              </label>
              <input id="lastName" type="text" class="input w-full" formControlName="lastName" />
            </div>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-medium text-content" for="phone">
              Teléfono
              @if (isRequired('phone')) {
                <span class="text-danger">*</span>
              }
            </label>
            <input id="phone" type="tel" class="input w-full" formControlName="phone" />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-medium text-content" for="email">
              Correo electrónico
              <span class="font-normal text-content-muted">(opcional)</span>
            </label>
            <input id="email" type="email" class="input w-full" formControlName="email" />
            <p class="text-2xs text-content-muted">
              Un correo real ayuda a recuperar el acceso. Si dejas el temporal, podrás seguir
              entrando; para recuperar la clave sin correo, acude a secretaría.
            </p>
          </div>

          @if (role() === 'STUDENT') {
            <div class="space-y-1">
              <label class="text-xs font-medium text-content" for="birthDate">
                Fecha de nacimiento
                <span class="font-normal text-content-muted">(opcional)</span>
              </label>
              <input id="birthDate" type="date" class="input w-full" formControlName="birthDate" />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-medium text-content" for="address">
                Dirección
                <span class="font-normal text-content-muted">(opcional)</span>
              </label>
              <input id="address" type="text" class="input w-full" formControlName="address" />
            </div>
          }

          <button type="submit" class="btn btn-primary w-full" [disabled]="form.invalid || busy()">
            @if (busy()) {
              <app-spinner [size]="16" />
            }
            Guardar y continuar
          </button>
        </form>
      }
    </div>
  `,
})
export class FirstLoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authApi = inject(AuthApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly busy = signal(false);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly role = signal<string>('OTHER');
  protected readonly requiredFields = signal<string[]>([]);

  protected readonly form = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
    firstName: [''],
    lastName: [''],
    phone: [''],
    email: ['', [Validators.email]],
    birthDate: [''],
    address: [''],
  });

  async ngOnInit(): Promise<void> {
    try {
      const onboarding = await firstValueFrom(this.authApi.getOnboarding());
      this.applyOnboarding(onboarding);
      if (!onboarding.mustChangePassword) {
        await this.router.navigateByUrl(ROUTES.DASHBOARD.ROOT);
        return;
      }
    } catch {
      const cached = this.auth.user();
      if (cached?.email) {
        this.form.patchValue({
          email: cached.email,
          phone: cached.phone ?? '',
          firstName: cached.firstName ?? '',
          lastName: cached.lastName ?? '',
        });
      }
      if (cached && !cached.mustChangePassword) {
        await this.router.navigateByUrl(ROUTES.DASHBOARD.ROOT);
        return;
      }
    } finally {
      this.loading.set(false);
    }
  }

  protected isRequired(field: string): boolean {
    return this.requiredFields().includes(field);
  }

  private applyOnboarding(o: OnboardingMe): void {
    this.role.set(o.role);
    this.requiredFields.set(o.requiredFields ?? []);
    this.form.patchValue({
      firstName: o.firstName ?? '',
      lastName: o.lastName ?? '',
      phone: o.phone ?? '',
      email: o.email ?? '',
      birthDate: o.birthDate ?? '',
      address: o.address ?? '',
    });
    for (const field of ['firstName', 'lastName', 'phone'] as const) {
      const ctrl = this.form.controls[field];
      if (o.requiredFields?.includes(field)) {
        ctrl.setValidators([Validators.required]);
      } else {
        ctrl.clearValidators();
      }
      ctrl.updateValueAndValidity({ emitEvent: false });
    }
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    if (raw.newPassword !== raw.confirmPassword) {
      this.errorMessage.set('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      const emailTrim = raw.email.trim().toLowerCase();
      const user = await firstValueFrom(
        this.authApi.completeOnboarding({
          currentPassword: raw.currentPassword,
          newPassword: raw.newPassword,
          firstName: raw.firstName.trim() || null,
          lastName: raw.lastName.trim() || null,
          phone: raw.phone.trim() || null,
          email: emailTrim || null,
          birthDate: raw.birthDate || null,
          address: raw.address.trim() || null,
        }),
      );
      this.auth.setUser(user);
      await this.router.navigateByUrl(ROUTES.DASHBOARD.ROOT);
    } catch {
      this.errorMessage.set(
        'No se pudo completar el registro. Verifica la contraseña temporal e inténtalo de nuevo.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
