import { Injectable } from '@angular/core';

/**
 * Centralized common UI labels (cierre-D / I4 bulk translation).
 *
 * <p>Like {@link NavLabels}, every method wraps the source string with a
 * {@code $localize} template tag carrying a stable {@code @@common.{id}}
 * message id so {@code ng extract-i18n} picks it up automatically.</p>
 *
 * <p>Coverage for MVP (highest-traffic actions): save / cancel / delete
 * / edit / create / close / back / search / download / upload / confirm
 * / refresh / yes / no. Buttons that don't appear in production yet
 * can be added incrementally — the extraction pipeline reconciles on the
 * next build.</p>
 */
@Injectable({ providedIn: 'root' })
export class CommonLabels {

	guardar(): string {
		return $localize`:@@common.action.save:Guardar`;
	}
	cancelar(): string {
		return $localize`:@@common.action.cancel:Cancelar`;
	}
	eliminar(): string {
		return $localize`:@@common.action.delete:Eliminar`;
	}
	editar(): string {
		return $localize`:@@common.action.edit:Editar`;
	}
	nuevo(): string {
		return $localize`:@@common.action.new:Nuevo`;
	}
	crear(): string {
		return $localize`:@@common.action.create:Crear`;
	}
	cerrar(): string {
		return $localize`:@@common.action.close:Cerrar`;
	}
	volver(): string {
		return $localize`:@@common.action.back:Volver`;
	}
	buscar(): string {
		return $localize`:@@common.action.search:Buscar`;
	}
	descargar(): string {
		return $localize`:@@common.action.download:Descargar`;
	}
	subir(): string {
		return $localize`:@@common.action.upload:Subir`;
	}
	confirmar(): string {
		return $localize`:@@common.action.confirm:Confirmar`;
	}
	reintentar(): string {
		return $localize`:@@common.action.retry:Reintentar`;
	}
	cargando(): string {
		return $localize`:@@common.action.loading:Cargando\u2026`;
	}
	actualizar(): string {
		return $localize`:@@common.action.refresh:Actualizar`;
	}
}
