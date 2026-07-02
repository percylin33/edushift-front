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
}

export interface CreateAnnouncementPayload {
  title: string;
  bodyHtml: string;
  audienceType: AnnouncementAudience;
  audienceIds?: string[];
  pinned?: boolean;
  publishAt?: string;
}
