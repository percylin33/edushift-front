import { Injectable } from '@angular/core';
import '@angular/localize/init';

/**
 * Centralized navigation labels (cierre-D / I4 bulk translation).
 *
 * <p>The navigation config is a TS file imported into the sidebar at
 * boot. Wrapping every label with {@code $localize} template tags
 * doesn't work cleanly because:
 * <ol>
 *   <li>The labels are TS string literals, not HTML — Angular's
 *       {@code $localize} parses markup and would mangle things.</li>
 *   <li>The config file is imported at module load time, which runs
 *       before the locale is selected.</li>
 * </ol>
 * <p>Instead, this service exposes one method per visible nav key. The
 * sidebar calls {@code NavLabels.labelFor(item.id)} instead of reading
 * {@code item.label} directly. When the user picks a different locale
 * in the language selector, the next render pulls the translated
 * label.</p>
 *
 * <p>Add new translations here when you add new nav items — the
 * source {@code es-PE} strings double as the i18n source in
 * {@code messages.es-PE.xlf} so {@code ng extract-i18n} picks them up.</p>
 */
@Injectable({ providedIn: 'root' })
export class NavLabels {

	labelFor(id: string): string {
		// Nav group labels.
		// Ids must match `navigation.config.ts` (`NAVIGATION_GROUPS` /
		// item `id`s). Legacy aliases kept so older keys still resolve.
		switch (id) {
			case 'workspace':
				return $localize`:@@nav.group.workspace:Espacio de trabajo`;
			case 'academic':
				return $localize`:@@nav.group.academic:Acad\u00e9mico`;
			case 'lms':
				return $localize`:@@nav.group.lms:Mis cursos`;
			case 'attendance':
				return $localize`:@@nav.group.attendance:Asistencia`;
			case 'payments':
				return $localize`:@@nav.group.payments:Pagos`;
			case 'system':
				return $localize`:@@nav.group.system:Sistema`;
			case 'insights':
			case 'analytics':
				return $localize`:@@nav.group.analytics:An\u00e1lisis`;

			// Nav item labels.
			case 'dashboard':
				return $localize`:@@nav.item.dashboard:Panel`;
			case 'students':
				return $localize`:@@nav.item.students:Estudiantes`;
			case 'teachers':
				return $localize`:@@nav.item.teachers:Docentes`;
			case 'academic-periods':
			case 'periods':
				return $localize`:@@nav.item.periods:Periodos`;
			case 'academic-years':
			case 'years':
				return $localize`:@@nav.item.years:A\u00f1os acad\u00e9micos`;
			case 'academic-levels':
			case 'levels':
				return $localize`:@@nav.item.levels:Niveles y grados`;
			case 'academic-sections':
			case 'sections':
				return $localize`:@@nav.item.sections:Secciones`;
			case 'academic-courses':
			case 'courses':
				return $localize`:@@nav.item.courses:Cursos`;
			case 'schedule':
				return $localize`:@@nav.item.schedule:Horarios`;
			case 'schedule-jornada':
				return $localize`:@@nav.item.schedule-jornada:Jornada y recreos`;
			case 'schedule-workload':
				return $localize`:@@nav.item.schedule-workload:Carga docente`;
			case 'rubrics':
				return $localize`:@@nav.item.rubrics:R\u00fabricas`;
			case 'learning-sessions':
			case 'sessions':
				return $localize`:@@nav.item.sessions:Sesiones de clase`;
			case 'evaluations':
				return $localize`:@@nav.item.evaluations:Evaluaciones`;
			case 'lms-mine':
				return $localize`:@@nav.item.lms-mine:Mis cursos`;
			case 'attendance-sessions':
				return $localize`:@@nav.item.attendance-sessions:Sesiones`;
			case 'attendance-scanner':
				return $localize`:@@nav.item.attendance-scanner:Esc\u00e1ner QR`;
			case 'family':
				return $localize`:@@nav.item.family:Mis hijos`;
			case 'me':
				return $localize`:@@nav.item.me:Mi espacio`;
			case 'me-courses':
				return $localize`:@@nav.item.me-courses:Mis cursos`;
			case 'me-schedule':
				return $localize`:@@nav.item.me-schedule:Mi horario`;
			case 'me-grades':
				return $localize`:@@nav.item.me-grades:Mis notas`;
			case 'me-attendance':
				return $localize`:@@nav.item.me-attendance:Mi asistencia`;
			case 'me-qr':
				return $localize`:@@nav.item.me-qr:Mi QR`;
			case 'me-payments':
				return $localize`:@@nav.item.me-payments:Mis pagos`;
			case 'payments-admin':
			case 'reconciliation':
				return $localize`:@@nav.item.reconciliation:Conciliaci\u00f3n`;
			case 'ai':
				return $localize`:@@nav.item.ai:Asistente IA`;
			case 'reports':
				return $localize`:@@nav.item.reports:Reportes`;
			case 'users':
				return $localize`:@@nav.item.users:Usuarios`;
			case 'notifications':
				return $localize`:@@nav.item.notifications:Notificaciones`;
			case 'announcements':
				return $localize`:@@nav.item.announcements:Anuncios`;
			case 'settings':
				return $localize`:@@nav.item.settings:Configuraci\u00f3n`;
			case 'help':
				return $localize`:@@nav.item.help:Centro de pruebas`;

			default:
				// Unknown id — return a placeholder so the sidebar
				// doesn't crash on a misconfigured config.
				return id;
		}
	}
}
