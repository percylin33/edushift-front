import { IconName } from '@shared/components';

export const COURSE_DEFAULT_ICON: IconName = 'book-open';
export const COURSE_DEFAULT_COLOR = '#64748B';

/** Curated hex palette for Peruvian K-12 subjects (2 rows in the form). */
export const COURSE_COLOR_PALETTE: readonly { hex: string; label: string }[] = [
  /* Row 1 — core curriculum */
  { hex: '#2563EB', label: 'Matemática' },
  { hex: '#F59E0B', label: 'Comunicación' },
  { hex: '#059669', label: 'Ciencia y Tecnología' },
  { hex: '#7C3AED', label: 'Ciencias Sociales' },
  { hex: '#0891B2', label: 'Inglés' },
  { hex: '#DC2626', label: 'Educación Física' },
  { hex: '#DB2777', label: 'Arte y Cultura' },
  { hex: '#0D9488', label: 'Personal Social / Tutoria' },
  /* Row 2 — complementary / specialties */
  { hex: '#4F46E5', label: 'Computación' },
  { hex: '#CA8A04', label: 'Educación Religiosa' },
  { hex: '#EA580C', label: 'Educación para el Trabajo' },
  { hex: '#65A30D', label: 'Educación Ambiental' },
  { hex: '#9333EA', label: 'Historia / Geografía' },
  { hex: '#E11D48', label: 'Música / Danza' },
  { hex: '#0284C7', label: 'Plan Lector' },
  { hex: '#64748B', label: 'General / Otros' },
] as const;

export function isCoursePaletteColor(hex: string | null | undefined): boolean {
  if (!hex) return false;
  const n = hex.trim().toUpperCase();
  return COURSE_COLOR_PALETTE.some((c) => c.hex === n);
}

/** Primary icons shown by default in the course form picker. */
export const COURSE_ICON_OPTIONS: readonly IconName[] = [
  'book-open',
  'target',
  'sparkles',
  'globe',
  'award',
  'layers',
  'palette',
  'graduation-cap',
  'file-text',
  'layout-grid',
  'clipboard-list',
  'list-checks',
] as const;

/**
 * Extra icons revealed via “Mostrar más iconos”.
 * Keep these out of the compact grid so the form stays scannable.
 */
export const COURSE_ICON_OPTIONS_MORE: readonly IconName[] = [
  'calculator',
  'flask-conical',
  'microscope',
  'atom',
  'music',
  'brush',
  'heart',
  'dumbbell',
  'trophy',
  'landmark',
  'languages',
  'book',
  'compass',
  'cpu',
  'leaf',
  'lightbulb',
  'puzzle',
  'ruler',
  'users',
  'user',
  'bar-chart',
  'trending-up',
  'calendar',
  'calendar-check',
  'clock',
  'map-pin',
  'building',
  'image',
  'megaphone',
  'message-square',
  'clipboard-check',
  'paperclip',
  'shield-check',
  'help-circle',
  'info',
  'play',
  'sun',
  'moon',
  'home',
  'search',
  'pencil',
] as const;

/** Union used for validation / resolve (primary + more, deduped). */
export const COURSE_ICON_ALL: readonly IconName[] = (() => {
  const seen = new Set<string>();
  const out: IconName[] = [];
  for (const name of [...COURSE_ICON_OPTIONS, ...COURSE_ICON_OPTIONS_MORE]) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
})();

export interface CourseVisual {
  icon: IconName;
  color: string;
}

/**
 * Suggest icon + color from course code (mirror of BE {@code CourseVisualDefaults}).
 */
export function suggestCourseVisual(code: string | null | undefined): CourseVisual {
  if (!code || !code.trim()) {
    return { icon: COURSE_DEFAULT_ICON, color: COURSE_DEFAULT_COLOR };
  }
  const normalized = code.trim().toUpperCase();

  if (startsWithAny(normalized, 'MAT')) {
    return { icon: 'target', color: '#2563EB' };
  }
  if (startsWithAny(normalized, 'COMU', 'COM')) {
    return { icon: 'book-open', color: '#F59E0B' };
  }
  if (startsWithAny(normalized, 'CCNN', 'CIE', 'CYT')) {
    return { icon: 'sparkles', color: '#059669' };
  }
  if (startsWithAny(normalized, 'CCSS', 'HIS', 'GEO')) {
    return { icon: 'globe', color: '#7C3AED' };
  }
  if (startsWithAny(normalized, 'ING')) {
    return { icon: 'globe', color: '#0891B2' };
  }
  if (startsWithAny(normalized, 'EDF', 'EF')) {
    return { icon: 'award', color: '#DC2626' };
  }
  if (startsWithAny(normalized, 'PROG', 'COMP')) {
    return { icon: 'layers', color: '#4F46E5' };
  }
  if (startsWithAny(normalized, 'ART')) {
    return { icon: 'palette', color: '#DB2777' };
  }
  if (startsWithAny(normalized, 'MUS')) {
    return { icon: 'music', color: '#E11D48' };
  }
  if (startsWithAny(normalized, 'VAL', 'PS', 'DPCC', 'REL')) {
    return { icon: 'award', color: '#0D9488' };
  }
  return { icon: COURSE_DEFAULT_ICON, color: COURSE_DEFAULT_COLOR };
}

/** Resolve display visual with fallbacks when API returns null. */
export function resolveCourseVisual(
  code: string,
  color?: string | null,
  icon?: string | null,
): CourseVisual {
  const suggested = suggestCourseVisual(code);
  const safeIcon =
    icon && (COURSE_ICON_ALL as readonly string[]).includes(icon)
      ? (icon as IconName)
      : suggested.icon;
  const safeColor =
    color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color.toUpperCase() : suggested.color;
  return { icon: safeIcon, color: safeColor };
}

/** Soft card background (~12% of course color). */
export function courseTintBg(color: string): string {
  return `color-mix(in srgb, ${color} 12%, transparent)`;
}

/** Soft border / left accent (~40% of course color). */
export function courseTintBorder(color: string): string {
  return `color-mix(in srgb, ${color} 40%, transparent)`;
}

/** Soft avatar chip background (~20% of course color). */
export function courseTintAvatarBg(color: string): string {
  return `color-mix(in srgb, ${color} 20%, transparent)`;
}

function startsWithAny(code: string, ...prefixes: string[]): boolean {
  return prefixes.some((p) => code === p || code.startsWith(p));
}
