import { CanMatchFn, Route, UrlSegment } from '@angular/router';

/** Path segments that must never bind to a param route (e.g. `:uuid`). */
const DEFAULT_RESERVED = ['new', 'edit'] as const;

/**
 * Prevents param routes like {@code assignments/:uuid} from consuming
 * literal segments such as {@code new} or {@code edit}.
 *
 * <p>When {@code canMatch} on a static sibling (e.g.
 * {@code assignments/new}) skips the route, Angular continues matching
 * and would otherwise treat {@code new} as a UUID — loading detail pages
 * that 404 with confusing copy.</p>
 */
export function rejectReservedSegmentsCanMatch(
  reserved: readonly string[] = DEFAULT_RESERVED,
): CanMatchFn {
  return (_route: Route, segments: UrlSegment[]) => {
    const last = segments.at(-1)?.path;
    return !last || !reserved.includes(last);
  };
}
