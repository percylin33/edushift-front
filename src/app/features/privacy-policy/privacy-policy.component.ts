import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicContactEmailsService } from '@core/services/public-contact-emails.service';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-900 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <!-- Container -->
      <div class="max-w-4xl mx-auto space-y-8">

        <!-- Header -->
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/40 to-slate-800/60 p-8 border border-slate-700/60 shadow-2xl backdrop-blur-md">
          <div class="flex items-center justify-between gap-4 flex-wrap">
            <div class="space-y-2">
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Ley N° 29733 — Perú
              </div>
              <h1 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Política de Privacidad
              </h1>
              <p class="text-sm text-slate-400">
                Última actualización: 8 de octubre de 2026 | EduShift SaaS
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
            <div class="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
              01
            </div>
            <h3 class="font-semibold text-slate-200 text-sm">Protección de Menores</h3>
            <p class="text-xs text-slate-400">
              Tratamiento de datos de menores conforme a las reglas de representación y consentimiento aplicables.
            </p>
          </div>

          <div class="p-5 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
              02
            </div>
            <h3 class="font-semibold text-slate-200 text-sm">Roles Claros</h3>
            <p class="text-xs text-slate-400">
              El Colegio es el Responsable del Banco de Datos; EduShift es el Encargado del Tratamiento SaaS.
            </p>
          </div>

          <div class="p-5 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2">
            <div class="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
              03
            </div>
            <h3 class="font-semibold text-slate-200 text-sm">Derechos ARCO</h3>
            <p class="text-xs text-slate-400">
              Garantía de Acceso, Rectificación, Cancelación y Oposición mediante canal formal.
            </p>
          </div>
        </div>

        <!-- Content Body -->
        <div class="bg-slate-800/40 rounded-2xl border border-slate-700/50 p-6 sm:p-10 space-y-8 text-slate-300 text-sm leading-relaxed">

          <!-- Section 1 -->
          <section class="space-y-3">
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-blue-500"></span>
              1. Identificación del Titular y Normativa Aplicable
            </h2>
            <p>
              La presente Política describe el tratamiento de datos personales realizado mediante <strong>EduShift</strong>, de conformidad con la <strong>Ley N° 29733</strong> y su Reglamento vigente, aprobado por el <strong>Decreto Supremo N° 016-2024-JUS</strong>, en vigor desde el 31 de marzo de 2025.
            </p>
            <p>
              Para consultas sobre privacidad o para iniciar una solicitud relacionada con tus datos, escribe a:
              <a [href]="'mailto:' + contactEmails().privacyEmail" class="text-blue-400 hover:underline">{{ contactEmails().privacyEmail }}</a>.
            </p>
          </section>

          <!-- Section 2 -->
          <section class="space-y-3">
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-blue-500"></span>
              2. Roles en el Tratamiento de Datos Personales
            </h2>
            <p>
              De acuerdo con la legislación vigente en el Perú, se distinguen los siguientes roles:
            </p>
            <ul class="list-disc pl-5 space-y-2 text-slate-300">
              <li>
                <strong class="text-white">EduShift como Titular del Banco de Datos:</strong> Es titular del banco de datos de clientes, administradores de colegios y prospectos comerciales contratantes de la solución SaaS.
              </li>
              <li>
                <strong class="text-white">El Colegio como Responsable y EduShift como Encargado:</strong> En lo que respecta a la información de estudiantes, apoderados, docentes y notas registradas en cada institución, la Institución Educativa (Colegio) es el Responsable del Banco de Datos, mientras que EduShift procesa la información en calidad de <strong>Encargado del Tratamiento</strong> bajo las instrucciones del colegio y los contratos correspondientes.
              </li>
            </ul>
          </section>

          <!-- Section 3 -->
          <section class="space-y-3">
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-blue-500"></span>
              3. Datos Recopilados y Categorías
            </h2>
            <p>
              Recopilamos y tratamos las siguientes categorías de datos estrictamente necesarias para el servicio escolar:
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div class="p-3 bg-slate-900/60 rounded-lg border border-slate-700/60">
                <span class="font-semibold text-slate-200 block mb-1">Datos de Usuarios/Apoderados:</span>
                Nombres, DNI/CE, correo electrónico, número telefónico, relación de parentesco.
              </div>
              <div class="p-3 bg-slate-900/60 rounded-lg border border-slate-700/60">
                <span class="font-semibold text-slate-200 block mb-1">Datos de Estudiantes (Menores):</span>
                Nombres, fecha de nacimiento, grado/sección, foto institucional, registro de asistencia y notas.
              </div>
              <div class="p-3 bg-slate-900/60 rounded-lg border border-slate-700/60">
                <span class="font-semibold text-slate-200 block mb-1">Datos Académicos y de Asistencia:</span>
                Evaluaciones, tareas, asistencias diarias, observaciones de tutoría.
              </div>
              <div class="p-3 bg-slate-900/60 rounded-lg border border-slate-700/60">
                <span class="font-semibold text-slate-200 block mb-1">Datos Técnicos y Auditoría:</span>
                Dirección IP, registros de sesión, fechas de acciones y navegador para proteger la información de cada institución.
              </div>
            </div>
          </section>

          <!-- Section 4 -->
          <section class="space-y-3">
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-blue-500"></span>
              4. Tratamiento Especial de Datos de Menores de Edad
            </h2>
            <div class="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 space-y-2">
              <div class="flex items-center gap-2 font-semibold">
                <svg class="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Cumplimiento del Art. 28 del Reglamento de la Ley 29733
              </div>
              <p class="text-xs text-amber-300/90">
                El colegio determina y documenta la base legal que corresponde al tratamiento de datos de sus estudiantes. Cuando la normativa exige autorización del representante legal, debe obtenerse antes del tratamiento. EduShift y el colegio deben tratar los datos de menores para finalidades legítimas vinculadas con el servicio educativo, con las salvaguardas exigidas por la normativa.
              </p>
            </div>
          </section>

          <!-- Section 5 -->
          <section class="space-y-3">
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-blue-500"></span>
              5. Medidas de Seguridad y Confidencialidad
            </h2>
            <p>
              EduShift aplica medidas técnicas y organizativas de seguridad para proteger los datos. Las medidas concretas se describen en la documentación contractual y de seguridad vigente; esta política no promete niveles de cifrado o certificaciones que no estén confirmados para cada entorno:
            </p>
            <ul class="list-disc pl-5 space-y-1.5 text-slate-300">
              <li>Autenticación y controles de acceso basados en roles y permisos.</li>
              <li>Separación de la información por institución educativa.</li>
              <li>Registro de acciones relevantes para auditoría y seguridad.</li>
              <li>Controles de acceso a los archivos y servicios de la plataforma.</li>
            </ul>
          </section>

          <!-- Section 6 -->
          <section class="space-y-3">
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-blue-500"></span>
              6. Ejercicio de Derechos ARCO (Acceso, Rectificación, Cancelación y Oposición)
            </h2>
            <p>
              Los titulares de los datos o sus apoderados legales pueden ejercer sus derechos enviando una solicitud formal a
              <a [href]="'mailto:' + contactEmails().privacyEmail" class="text-blue-400 hover:underline font-semibold">{{ contactEmails().privacyEmail }}</a>
              o a la administración del Colegio correspondiente.
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div class="p-3 bg-slate-900/40 rounded-lg border border-slate-700/40">
                <span class="text-xs font-semibold text-slate-300 block">Derecho de Acceso</span>
                <span class="text-xs text-slate-400">Respuesta en un plazo máximo de 20 días calendario.</span>
              </div>
              <div class="p-3 bg-slate-900/40 rounded-lg border border-slate-700/40">
                <span class="text-xs font-semibold text-slate-300 block">Rectificación / Cancelación / Oposición</span>
                <span class="text-xs text-slate-400">Respuesta en un plazo máximo de 10 días calendario.</span>
              </div>
            </div>
            <p class="text-xs text-slate-400">El derecho de información se atiende en un máximo de 8 días calendario. Los plazos se cuentan desde el día siguiente a la presentación. Los plazos de acceso, rectificación, cancelación y oposición pueden ampliarse una sola vez, por un plazo igual y con justificación comunicada dentro del plazo inicial. Puedes acudir a la Autoridad Nacional de Protección de Datos Personales si no recibes respuesta o esta resulta denegatoria.</p>
          </section>

          <section class="space-y-3">
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-blue-500"></span>
              Uso de herramientas de inteligencia artificial
            </h2>
            <p>Cuando un docente utiliza las funciones de IA, el contenido que introduce y el resultado generado se procesan para generar el resultado solicitado y pueden enviarse al proveedor de modelo configurado para EduShift. Evita incluir nombres, documentos u otros identificadores de estudiantes en las solicitudes. El colegio debe revisar las condiciones vigentes y contar con la base legal que corresponda antes de introducir información personal.</p>
          </section>

          <!-- Section 7 -->
          <section class="space-y-3">
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-blue-500"></span>
              7. Modificaciones a la Política
            </h2>
            <p>
              EduShift se reserva el derecho de modificar la presente Política de Privacidad para adecuarla a futuras reformas legislativas o criterios de la Autoridad Nacional de Protección de Datos Personales (ANPD).
            </p>
          </section>

        </div>

        <!-- Footer Note -->
        <div class="text-center text-xs text-slate-500 pt-4">
          <p>© 2026 EduShift. Todos los derechos reservados.</p>
        </div>

      </div>
    </div>
  `,
})
export class PrivacyPolicyComponent {
  readonly contactEmails = inject(PublicContactEmailsService).emails;
}
