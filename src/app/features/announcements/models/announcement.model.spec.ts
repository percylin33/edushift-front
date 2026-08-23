import { Announcement, CreateAnnouncementPayload, AnnouncementAudience, AnnouncementStatus } from './announcement.model';

describe('AnnouncementModel', () => {
  describe('AnnouncementAudience', () => {
    it('accepts the six canonical values', () => {
      const values: AnnouncementAudience[] = ['SCHOOL', 'GRADE', 'SECTION', 'COURSE', 'ROLE', 'USER'];
      expect(values).toHaveSize(6);
    });
  });

  describe('AnnouncementStatus', () => {
    it('includes the four lifecycle states', () => {
      const values: AnnouncementStatus[] = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'];
      expect(values).toHaveSize(4);
    });
  });

  describe('Announcement shape', () => {
    it('round-trips a minimal payload', () => {
      const a: Announcement = {
        publicUuid: '00000000-0000-0000-0000-000000000001',
        authorUserId: '00000000-0000-0000-0000-000000000002',
        title: 'Reunión de padres',
        bodyHtml: '<p>Saludos</p>',
        audienceType: 'SCHOOL',
        audienceIds: [],
        status: 'PUBLISHED',
        pinned: false,
        createdAt: new Date().toISOString(),
      };
      expect(a.title).toBe('Reunión de padres');
      expect(a.pinned).toBeFalse();
    });
  });

  describe('CreateAnnouncementPayload', () => {
    it('requires title, body and audienceType', () => {
      const p: CreateAnnouncementPayload = {
        title: 'Tarea',
        bodyHtml: '<p>...</p>',
        audienceType: 'GRADE',
      };
      expect(p.audienceIds).toBeUndefined();
      expect(p.publishAt).toBeUndefined();
    });
  });
});
