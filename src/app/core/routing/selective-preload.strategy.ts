import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';

/**
 * Precarga solo las rutas que lo piden con `data: { preload: true }`.
 *
 * `PreloadAllModules` disparaba cada `loadChildren` al pintar el login, y en
 * una red lenta eso sumaba cientos de viajes antes de que el usuario entrara.
 * Sin el flag, el chunk se baja en la navegación real.
 */
@Injectable({ providedIn: 'root' })
export class SelectivePreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    return route.data?.['preload'] === true ? load() : of(null);
  }
}
