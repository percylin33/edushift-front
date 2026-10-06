/**
 * Announcement model (Sprint 9 / FE-9.2).
 *
 * <p>Mirrors the backend's {@code Announcement} entity. Audience
 * targeting: {@code SCHOOL} (all users), {@code GRADE}, {@code
 * SECTION}, {@code COURSE}, {@code ROLE}, {@code USER}. The IDs list
 * is opaque — the FE sends the right id type and the BE resolves.</p>
 */
export type AnnouncementAudience = 'SCHOOL' | 'GRADE' | 'SECTION' | 'COURSE' | 'ROLE' | 'USER';

export type AnnouncementStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';

export interface Announcement {
  publicUuid: string;
  authorUserId: string;
  title: string;
  bodyHtml: string;
  audienceType: AnnouncementAudience;
  audienceIds: string[];
  status: AnnouncementStatus;
  pinned: boolean;
  publishAt?: string;
  publishedAt?: string;
  createdAt: string;
  includeGuardians?: boolean;
  /** False when the caller has not opened it. Null when read state is unknown. */
  read?: boolean | null;
}

export interface AudiencePreview {
  students: number;
  teachers: number;
  guardians: number;
  total: number;
}

export interface TeachingScopeOption {
  id: string;
  label: string;
  subtitle?: string;
}

export interface TeachingScope {
  sections: TeachingScopeOption[];
  courses: TeachingScopeOption[];
}

export interface CreateAnnouncementPayload {
  title: string;
  bodyHtml: string;
  audienceType: AnnouncementAudience;
  audienceIds?: string[];
  pinned?: boolean;
  publishAt?: string | null;
  includeGuardians?: boolean;
}
