/**
 * LMS Material model + DTOs (FE-7a.3 / BE-7a.1).
 *
 * <h3>Por qué un archivo separado</h3>
 * El material tiene su propio lifecycle (no lleva la noción de
 * "lifecycle" del task, sólo de visibilidad) y su DTO de upload es
 * multipart con un {@code type} discriminador que decide la forma
 * (file vs link). Mantener los modelos aislados evita que el
 * componente de Materials arrastre el modelo de Submission y
 * vice-versa.
 */

/**
 * Tipos de material soportados por el backend.
 *
 * <ul>
 *   <li>{@code PDF} — PDF binario.</li>
 *   <li>{@code IMAGE} — JPG/PNG/WebP.</li>
 *   <li>{@code DOC} — Word/Excel/Sheets, etc.</li>
 *   <li>{@code LINK} — URL externa (no binario).</li>
 *   <li>{@code OTHER} — fallback.</li>
 * </ul>
 *
 * <p>El backend deriva el tipo del MIME cuando es file; el cliente
 * lo declara explícitamente para {@code LINK} (en ese caso no hay
 * archivo, sólo URL).</p>
 */
export enum MaterialType {
  Pdf = 'PDF',
  Image = 'IMAGE',
  Doc = 'DOC',
  Link = 'LINK',
  Other = 'OTHER',
}

/** {@code MaterialResponseRaw} — full payload (BE-7a.1). */
export interface MaterialResponseRaw {
  publicUuid: string;
  sectionPublicUuid: string;
  title: string;
  type: MaterialType;
  /** Only for {@code type=FILE_*}; null for {@code LINK}. */
  filename: string | null;
  sizeBytes: number | null;
  contentType: string | null;
  /** Only for {@code type=LINK}. */
  url: string | null;
  /** Public UUID of the teacher who uploaded it. */
  uploadedByTeacherPublicUuid: string;
  uploadedByTeacherName: string;
  /** Signed Firebase URL, time-limited (5 min). Null until first download. */
  downloadUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

/** {@code MaterialSummaryRaw} — listing projection. */
export interface MaterialSummaryRaw {
  publicUuid: string;
  title: string;
  type: MaterialType;
  filename: string | null;
  sizeBytes: number | null;
  contentType: string | null;
  url: string | null;
  uploadedByTeacherName: string;
  /** 0 if {@code type=LINK} (no file). */
  sizeBytesDisplay: string | null;
  createdAt: string;
}

/**
 * Domain {@code Material}. Mirrors {@link MaterialResponseRaw} with
 * ISO strings → {@code Date}.
 */
export interface Material {
  publicUuid: string;
  sectionPublicUuid: string;
  title: string;
  type: MaterialType;
  filename: string | null;
  sizeBytes: number | null;
  contentType: string | null;
  url: string | null;
  uploadedByTeacherPublicUuid: string;
  uploadedByTeacherName: string;
  downloadUrl: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

/** Compact row used in the listing. */
export interface MaterialRow {
  publicUuid: string;
  title: string;
  type: MaterialType;
  filename: string | null;
  sizeBytes: number | null;
  contentType: string | null;
  url: string | null;
  uploadedByTeacherName: string;
  sizeBytesDisplay: string | null;
  createdAt: Date;
}

/**
 * Multipart body for {@code POST /v1/lms/sections/{uuid}/materials}.
 *
 * <p>Send as {@code multipart/form-data}. For {@code LINK} materials
 * {@code file} is omitted and {@code url} is required. For file
 * materials {@code url} is omitted and {@code file} is required.
 */
export interface CreateMaterialRequest {
  title: string;
  type: MaterialType;
  file?: File | null;
  url?: string | null;
}

/* --------------------------------------------------------------------------
 * Adapters
 * ------------------------------------------------------------------------ */

export function toMaterial(raw: MaterialResponseRaw): Material {
  return {
    publicUuid: raw.publicUuid,
    sectionPublicUuid: raw.sectionPublicUuid,
    title: raw.title,
    type: raw.type,
    filename: raw.filename ?? null,
    sizeBytes: raw.sizeBytes ?? null,
    contentType: raw.contentType ?? null,
    url: raw.url ?? null,
    uploadedByTeacherPublicUuid: raw.uploadedByTeacherPublicUuid,
    uploadedByTeacherName: raw.uploadedByTeacherName,
    downloadUrl: raw.downloadUrl ?? null,
    createdAt: new Date(raw.createdAt),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : null,
  };
}

export function toMaterialRow(raw: MaterialSummaryRaw): MaterialRow {
  return {
    publicUuid: raw.publicUuid,
    title: raw.title,
    type: raw.type,
    filename: raw.filename ?? null,
    sizeBytes: raw.sizeBytes ?? null,
    contentType: raw.contentType ?? null,
    url: raw.url ?? null,
    uploadedByTeacherName: raw.uploadedByTeacherName,
    sizeBytesDisplay: raw.sizeBytesDisplay ?? null,
    createdAt: new Date(raw.createdAt),
  };
}

/* --------------------------------------------------------------------------
 * Pure helpers
 * ------------------------------------------------------------------------ */

/**
 * Whitelist of file MIME types aceptados para upload (todo lo
 * distinto es rechazado client-side). El backend vuelve a
 * enforcear — el cliente es defensa en profundidad.
 */
export const ALLOWED_FILE_MIME: ReadonlyArray<string> = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
] as const;

/** Max upload size (50 MB) — mirrors backend `lms.material.max-file-size`. */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Human-readable form of {@link MAX_FILE_SIZE_BYTES}. */
export const MAX_FILE_SIZE_LABEL = '50 MB';

/**
 * Returns the icon name (from the registry) to render on the
 * {@link MaterialCardComponent} for the given {@link MaterialType}.
 */
export function materialTypeIcon(type: MaterialType): string {
  switch (type) {
    case MaterialType.Pdf:
      return 'file-text';
    case MaterialType.Image:
      return 'image';
    case MaterialType.Doc:
      return 'file-text';
    case MaterialType.Link:
      return 'globe';
    case MaterialType.Other:
      return 'paperclip';
  }
}

/** Human-readable label per {@link MaterialType}. */
export function materialTypeLabel(type: MaterialType): string {
  switch (type) {
    case MaterialType.Pdf:
      return 'PDF';
    case MaterialType.Image:
      return 'Imagen';
    case MaterialType.Doc:
      return 'Documento';
    case MaterialType.Link:
      return 'Enlace';
    case MaterialType.Other:
      return 'Otro';
  }
}

/**
 * Suggest a {@link MaterialType} based on a file's MIME type. Used
 * by the upload dialog to pre-fill the type selector.
 */
export function inferMaterialTypeFromMime(mime: string): MaterialType {
  if (mime === 'application/pdf') return MaterialType.Pdf;
  if (mime.startsWith('image/')) return MaterialType.Image;
  if (
    mime.startsWith('application/msword') ||
    mime.startsWith('application/vnd.openxmlformats-officedocument.wordprocessingml') ||
    mime.startsWith('application/vnd.ms-excel') ||
    mime.startsWith('application/vnd.openxmlformats-officedocument.spreadsheetml') ||
    mime.startsWith('application/vnd.ms-powerpoint') ||
    mime.startsWith('application/vnd.openxmlformats-officedocument.presentationml')
  ) {
    return MaterialType.Doc;
  }
  return MaterialType.Other;
}

/** Is the material a binary file (vs a link)? */
export function isFileMaterial(type: MaterialType): boolean {
  return type !== MaterialType.Link;
}
