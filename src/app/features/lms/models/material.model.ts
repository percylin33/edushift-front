/**
 * LMS Material model + DTOs (FE-7a.3 / BE-7a.1).
 */

export enum MaterialType {
  Pdf = 'PDF',
  Image = 'IMAGE',
  Doc = 'DOC',
  Link = 'LINK',
  Other = 'OTHER',
}

/** Nested file projection from {@link MaterialResponseRaw}. */
export interface MaterialFileRaw {
  publicUuid: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256?: string | null;
  url: string | null;
  createdAt: string;
}

/** Full payload (BE-7a.1). */
export interface MaterialResponseRaw {
  publicUuid: string;
  sectionPublicUuid: string;
  title: string;
  description?: string | null;
  kind: string;
  file: MaterialFileRaw | null;
  externalUrl: string | null;
  ownerPublicUuid: string;
  createdAt: string;
  updatedAt: string | null;
  teacherAssignmentPublicUuid?: string | null;
  coursePublicUuid?: string | null;
  courseName?: string | null;
  periodLabel?: string | null;
}

/** Listing projection — aligned with BE {@code MaterialSummary}. */
export interface MaterialSummaryRaw {
  publicUuid: string;
  title: string;
  kind: string;
  fileSizeBytes: number | null;
  ownerPublicUuid: string | null;
  createdAt: string;
  teacherAssignmentPublicUuid?: string | null;
  coursePublicUuid?: string | null;
  courseName?: string | null;
  periodLabel?: string | null;
  filePublicUuid: string | null;
  filename: string | null;
  contentType: string | null;
  externalUrl: string | null;
}

export interface Material {
  publicUuid: string;
  sectionPublicUuid: string;
  title: string;
  type: MaterialType;
  filename: string | null;
  sizeBytes: number | null;
  contentType: string | null;
  url: string | null;
  filePublicUuid: string | null;
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
  filePublicUuid: string | null;
  uploadedByTeacherName: string;
  sizeBytesDisplay: string | null;
  createdAt: Date;
}

export interface CreateMaterialRequest {
  title: string;
  type: MaterialType;
  file?: File | null;
  url?: string | null;
  description?: string | null;
  teacherAssignmentPublicUuid: string;
}

export function toMaterial(raw: MaterialResponseRaw): Material {
  const file = raw.file;
  const type = kindToMaterialType(raw.kind, file?.contentType ?? null, file?.originalName ?? null);
  return {
    publicUuid: raw.publicUuid,
    sectionPublicUuid: raw.sectionPublicUuid,
    title: raw.title,
    type,
    filename: file?.originalName ?? null,
    sizeBytes: file?.sizeBytes ?? null,
    contentType: file?.contentType ?? null,
    url: raw.externalUrl ?? null,
    filePublicUuid: file?.publicUuid ?? null,
    uploadedByTeacherPublicUuid: raw.ownerPublicUuid,
    uploadedByTeacherName: '',
    downloadUrl: file?.url ?? null,
    createdAt: new Date(raw.createdAt),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : null,
  };
}

export function toMaterialRow(raw: MaterialSummaryRaw): MaterialRow {
  const type = kindToMaterialType(raw.kind, raw.contentType, raw.filename);
  return {
    publicUuid: raw.publicUuid,
    title: raw.title,
    type,
    filename: raw.filename ?? null,
    sizeBytes: raw.fileSizeBytes ?? null,
    contentType: raw.contentType ?? null,
    url: raw.externalUrl ?? null,
    filePublicUuid: raw.filePublicUuid ?? null,
    uploadedByTeacherName: '',
    sizeBytesDisplay: raw.fileSizeBytes != null ? formatSizeBytes(raw.fileSizeBytes) : null,
    createdAt: new Date(raw.createdAt),
  };
}

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

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = '50 MB';

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

export function isFileMaterial(type: MaterialType): boolean {
  return type !== MaterialType.Link;
}

function kindToMaterialType(
  kind: string,
  contentType: string | null,
  filename: string | null,
): MaterialType {
  if (kind === 'VIDEO_LINK') return MaterialType.Link;
  const mime = contentType ?? guessMimeFromFilename(filename);
  return inferMaterialTypeFromMime(mime);
}

function guessMimeFromFilename(filename: string | null): string {
  if (!filename) return 'application/octet-stream';
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return 'application/octet-stream';
}

function formatSizeBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
