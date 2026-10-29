import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicContactEmailsService } from '@core/services/public-contact-emails.service';

@Component({
  selector: 'app-terms-and-conditions',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-900 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <!-- Container -->
      <div class="max-w-4xl mx-auto space-y-8">

        <!-- Header -->
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 via-indigo-950 to-slate-900 p-8 border border-slate-700/60 shadow-2xl backdrop-blur-md">
          <div class="flex items-center justify-between gap-4 flex-wrap">
            <div class="space-y-2">
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-medium border border-indigo-500/20">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Contrato de Servicio SaaS
              </div>
              <h1 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Términos y Condiciones del Servicio
              </h1>
              <p class="text-sm text-slate-400">
                Última actualización: 8 de octubre de 2026 | EduShift
              </p>
            </div>
            <a
              routerLink="/auth/login"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-700 rounded-lg border border-slate-600 transition-colors shadow-sm"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Volver al inicio
            </a>
          </div>
        </div>

        <!-- Quick Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-5 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2">
            <div class="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
              SLA
            </div>
            <h3 class="font-semibold text-slate-200 text-sm">Disponibilidad del servicio</h3>
            <p class="text-xs text-slate-400">
              Las condiciones de disponibilidad aplicables se definen en el contrato del plan contratado.
            </p>
          </div>

          <div class="p-5 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2">
            <div class="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
              DATOS
            </div>
            <h3 class="font-semibold text-slate-200 text-sm">Propiedad Exclusiva</h3>
            <p class="text-xs text-slate-400">
              La institución educativa es propietaria exclusiva de todos los datos y archivos ingresados.
            </p>
          </div>

          <div class="p-5 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
              SEG
            </div>
            <h3 class="font-semibold text-slate-200 text-sm">Acceso por roles</h3>
            <p class="text-xs text-slate-400">
              Los permisos y accesos se administran según el rol del usuario y el colegio.
            </p>
          </div>
        </div>

        <!-- Content Body -->
        <div class="bg-slate-800/40 rounded-2xl border border-slate-700/50 p-6 sm:p-10 space-y-8 text-slate-300 text-sm leading-relaxed">

          <!-- Section 1 -->
          <section class="space-y-3">
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
              1. Identificación y Aceptación del Servicio
            </h2>
            <p>
              Estos Términos regulan el uso de la plataforma de gestión escolar <strong>EduShift</strong>. La razón social, el RUC y el domicilio del proveedor deben figurar en la propuesta y el contrato aceptados por la institución educativa. El acceso de usuarios invitados se rige por los permisos otorgados por su institución; por sí solo, el acceso no sustituye la aceptación del contrato comercial por el colegio.
            </p>
          </section>

          <!-- Section 2 -->
          <section class="space-y-3">
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
              2. Servicios Prestados
            </h2>
            <p>
              EduShift ofrece herramientas para gestión académica, asistencia, evaluaciones, tareas, materiales, quizzes, comunicaciones, reportes, seguimiento de pensiones y generación de contenido con IA. El alcance y la disponibilidad de cada módulo dependen del plan y la configuración contratados. La plataforma no sustituye los procedimientos oficiales que correspondan a la institución ante el MINEDU, SIAGIE o SUNAT.
            </p>
          </section>

          <!-- Section 3 -->
          <section class="space-y-3">
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
              3. Cuentas de Usuario y Seguridad
            </h2>
            <p>
              Cada usuario es responsable de mantener la privacidad de su contraseña. Queda expresamente prohibido compartir credenciales de acceso, ceder cuentas a terceros o intentar eludir los controles de seguridad multi-tenant de la plataforma.
            </p>
          </section>

          <!-- Section 4 -->
          <section class="space-y-3">
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
              4. Niveles de Servicio (SLA) y Soporte
            </h2>
            <p>
              Las condiciones de disponibilidad, mantenimiento, soporte y tiempos de atención son las establecidas en la propuesta y el contrato del plan contratado. Para soporte general, los administradores pueden escribir a <a [href]="'mailto:' + contactEmails().supportEmail" class="text-indigo-400 hover:underline">{{ contactEmails().supportEmail }}</a>.
            </p>
          </section>

          <!-- Section 5 -->
          <section class="space-y-3">
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
              5. Suscripción, Pagos y Facturación
            </h2>
            <p>
              El precio, la periodicidad, los impuestos, la forma de facturación, los límites de uso, el procedimiento de cobranza y las condiciones ante pagos pendientes se indican en la propuesta y el contrato aceptados por el colegio. La landing no reemplaza esos documentos comerciales.
            </p>
          </section>

          <!-- Section 6 -->
          <section class="space-y-3">
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
              6. Propiedad Intelectual y Titularidad de Datos
            </h2>
            <p>
              EduShift conserva los derechos sobre su plataforma y tecnología. La información que el colegio incorpora se trata según las instrucciones y el contrato aplicable. Para datos personales, rige además la <a routerLink="/politica-privacidad" class="text-indigo-400 underline">Política de Privacidad</a> y el acuerdo de encargo de tratamiento que corresponda.
            </p>
          </section>

          <!-- Section 7 -->
          <section class="space-y-3">
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
              7. Terminación y Exportación de Datos
            </h2>
            <p>
              La terminación, el periodo de disponibilidad para exportar, los formatos de entrega y la eliminación o devolución de datos se rigen por el contrato y el acuerdo de encargo de tratamiento aplicables al colegio. El colegio debe solicitar y completar la exportación dentro del plazo que allí se establezca.
            </p>
          </section>

          <!-- Section 8 -->
          <section class="space-y-3">
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
              8. Jurisdicción Aplicable
            </h2>
            <p>
              Estos Términos se rigen por las leyes de la República del Perú. La competencia y los mecanismos de solución de controversias se sujetan al contrato aplicable y a las normas imperativas de protección al consumidor y de protección de datos personales.
            </p>
          </section>

        </div>

        <p class="text-center text-xs text-slate-500">Para asuntos legales, escribe a <a [href]="'mailto:' + contactEmails().legalEmail" class="font-semibold text-indigo-400 underline">{{ contactEmails().legalEmail }}</a>.</p>

        <!-- Footer Note -->
        <div class="text-center text-xs text-slate-500 pt-4">
          <p>© 2026 EduShift. Todos los derechos reservados.</p>
        </div>

      </div>
    </div>
  `,
})
export class TermsAndConditionsComponent {
  readonly contactEmails = inject(PublicContactEmailsService).emails;
}
