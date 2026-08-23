import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AnnouncementsApiService } from './announcements-api.service';
import { Announcement, CreateAnnouncementPayload } from '../models/announcement.model';

const sample: Announcement = {
  publicUuid: 'abc',
  authorUserId: 'author-1',
  title: 'Tarea',
  bodyHtml: '<p>x</p>',
  audienceType: 'SCHOOL',
  audienceIds: [],
  status: 'DRAFT',
  pinned: false,
  createdAt: '2026-01-01T00:00:00Z',
};

describe('AnnouncementsApiService', () => {
  let service: AnnouncementsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AnnouncementsApiService],
    });
    service = TestBed.inject(AnnouncementsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() hits GET /api/v1/announcements and unwraps data', () => {
    let result: Announcement[] | undefined;
    service.list().subscribe((rows) => (result = rows));
    const req = http.expectOne((r) => r.url.endsWith('/api/v1/announcements') && r.method === 'GET');
    req.flush({ success: true, data: [sample] });
    expect(result).toEqual([sample]);
  });

  it('get() hits GET /api/v1/announcements/{uuid} and unwraps data', () => {
    let result: Announcement | undefined;
    service.get('abc').subscribe((row) => (result = row));
    const req = http.expectOne(
      (r) => r.url.endsWith('/api/v1/announcements/abc') && r.method === 'GET',
    );
    req.flush({ success: true, data: sample });
    expect(result).toEqual(sample);
  });

  it('create() posts to /api/v1/announcements and unwraps data', () => {
    const payload: CreateAnnouncementPayload = {
      title: 'Tarea',
      bodyHtml: '<p>x</p>',
      audienceType: 'SCHOOL',
    };
    let result: Announcement | undefined;
    service.create(payload).subscribe((row) => (result = row));
    const req = http.expectOne((r) => r.url.endsWith('/api/v1/announcements') && r.method === 'POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ success: true, data: sample });
    expect(result?.publicUuid).toBe('abc');
  });

  it('publish() posts to /api/v1/announcements/{uuid}/publish and unwraps data', () => {
    let result: Announcement | undefined;
    service.publish('abc').subscribe((row) => (result = row));
    const req = http.expectOne(
      (r) => r.url.endsWith('/api/v1/announcements/abc/publish') && r.method === 'POST',
    );
    req.flush({
      success: true,
      data: { ...sample, status: 'PUBLISHED', publishedAt: '2026-01-01T01:00:00Z' },
    });
    expect(result?.status).toBe('PUBLISHED');
  });

  it('markRead() posts to /api/v1/announcements/{uuid}/read', () => {
    service.markRead('abc').subscribe();
    const req = http.expectOne(
      (r) => r.url.endsWith('/api/v1/announcements/abc/read') && r.method === 'POST',
    );
    req.flush({ success: true, data: null });
  });
});
