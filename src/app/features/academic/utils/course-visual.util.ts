import { IconName } from '@shared/components';

export const COURSE_DEFAULT_ICON: IconName = 'book-open';
export const COURSE_DEFAULT_COLOR = '#64748B';

/**
 * Curated hex palette for the Peru course catalog.
 * Personal Social and Ciencias Sociales share orange on purpose.
 * Subjects without a requested color get a unique swatch.
 */
export const COURSE_COLOR_PALETTE: readonly { hex: string; label: string }[] = [
  { hex: '#DC2626', label: 'Comunicación' },
  { hex: '#2563EB', label: 'Matemática' },
  { hex: '#F97316', label: 'Personal Social / Ciencias Sociales' },
  { hex: '#16A34A', label: 'Ciencia y Tecnología' },
  { hex: '#EAB308', label: 'Inglés' },
  { hex: '#FFFFFF', label: 'Educación Religiosa' },
  { hex: '#7C3AED', label: 'Arte y Cultura' },
  { hex: '#DB2777', label: 'Educación Física' },
  { hex: '#22D3EE', label: 'Computación' },
  { hex: '#0F766E', label: 'Desarrollo Personal, Ciudadanía y Cívica' },
  { hex: '#B45309', label: 'Educación para el Trabajo' },
  { hex: '#84CC16', label: 'Psicomotricidad' },
  { hex: '#6366F1', label: 'Tutoría' },
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

  if (matches(normalized, 'COMP', 'PROG')) {
    return { icon: 'cpu', color: '#22D3EE' };
  }
  if (matches(normalized, 'COMU') || exact(normalized, 'COM')) {
    return { icon: 'book-open', color: '#DC2626' };
  }
  if (matches(normalized, 'PSI')) {
    return { icon: 'user', color: '#84CC16' };
  }
  if (exact(normalized, 'PS')) {
    return { icon: 'users', color: '#F97316' };
  }
  if (matches(normalized, 'CYT', 'CCNN', 'CIE')) {
    return { icon: 'sparkles', color: '#16A34A' };
  }
  if (matches(normalized, 'CCSS', 'HIS', 'GEO')) {
    return { icon: 'globe', color: '#F97316' };
  }
  if (matches(normalized, 'DPCC')) {
    return { icon: 'award', color: '#0F766E' };
  }
  if (matches(normalized, 'EPT')) {
    return { icon: 'clipboard-list', color: '#B45309' };
  }
  if (matches(normalized, 'ING')) {
    return { icon: 'languages', color: '#EAB308' };
  }
  if (exact(normalized, 'EF')) {
    return { icon: 'dumbbell', color: '#DB2777' };
  }
  if (exact(normalized, 'ER') || matches(normalized, 'REL')) {
    return { icon: 'book', color: '#FFFFFF' };
  }
  if (matches(normalized, 'TUT')) {
    return { icon: 'users', color: '#6366F1' };
  }
  if (exact(normalized, 'AC') || matches(normalized, 'ART')) {
    return { icon: 'palette', color: '#7C3AED' };
  }
  if (normalized.startsWith('MAT')) {
    return { icon: 'target', color: '#2563EB' };
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

/** Dark icon on white, yellow, lime and celeste chips; white icon otherwise. */
export function courseChipForeground(hex: string): string {
  const raw = hex.trim().replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(raw)) return '#FFFFFF';
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#0F172A' : '#FFFFFF';
}

function matches(code: string, ...keys: string[]): boolean {
  return keys.some(
    (key) =>
      exact(code, key) ||
      (key.length >= 3 && code.startsWith(key) && !code.startsWith(`${key}_`)),
  );
}

function exact(code: string, key: string): boolean {
  return code === key || code.startsWith(`${key}-`);
}
