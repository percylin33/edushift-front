import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NotificationsApiService } from './notifications-api.service';
import { ApiService } from '@core/services';

describe('NotificationsApiService', () => {
  let service: NotificationsApiService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'put', 'patch', 'delete']);
    TestBed.configureTestingModule({
      providers: [NotificationsApiService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(NotificationsApiService);
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  describe('list', () => {
    it('obtiene listado envuelto en ApiResponse', (done) => {
      apiSpy.get.and.returnValue(
        of({ success: true, data: [], meta: { total: 0, page: 0, size: 20 } })
      );
      service.list().subscribe((res) => {
        expect(res.success).toBeTrue();
        expect(res.data).toEqual([]);
        done();
      });
    });

    it('filtra solo no leídas', (done) => {
      apiSpy.get.and.returnValue(
        of({
          success: true,
          data: [{ id: 'n1', title: 'Test', publicUuid: 'p-1' } as any],
          meta: { total: 1, page: 0, size: 20 },
        })
      );
      service.list(true).subscribe(() => {
        expect(apiSpy.get).toHaveBeenCalledWith(jasmine.any(String), { unreadOnly: true });
        done();
      });
    });
  });

  describe('listUnreadCount', () => {
    it('obtiene conteo de no leídas (envoltorio ApiResponse)', (done) => {
      apiSpy.get.and.returnValue(
        of({ success: true, data: { unreadCount: 5 }, timestamp: '2026-07-22' })
      );
      service.listUnreadCount().subscribe((res) => {
        expect(res.data.unreadCount).toBe(5);
        done();
      });
    });
  });

  describe('markRead', () => {
    it('marca como leída', (done) => {
      apiSpy.patch.and.returnValue(of({ publicUuid: 'p-1', readAt: '2026-01-01' } as any));
      service.markRead('p-1').subscribe((res) => {
        expect(res.publicUuid).toBe('p-1');
        done();
      });
    });
  });

  describe('markAllRead', () => {
    it('marca todas como leídas', (done) => {
      apiSpy.post.and.returnValue(of({ updated: 3 }));
      service.markAllRead().subscribe((res) => {
        expect(res).toEqual({ updated: 3 });
        done();
      });
    });
  });

  describe('getPreferences', () => {
    it('obtiene preferencias', (done) => {
      apiSpy.get.and.returnValue(of([{ category: 'GRADE', channel: 'EMAIL', enabled: true }]));
      service.getPreferences().subscribe((rows) => {
        expect(rows.length).toBe(1);
        done();
      });
    });
  });

  describe('updatePreference', () => {
    it('actualiza una preferencia', (done) => {
      const row = { category: 'GRADE' as const, channel: 'EMAIL' as const, enabled: false };
      apiSpy.post.and.returnValue(of(row));
      service.updatePreference(row).subscribe((res) => {
        expect(res.enabled).toBeFalse();
        done();
      });
    });
  });

  describe('updatePreferences', () => {
    it('actualiza preferencias en bulk', (done) => {
      const payload = {
        inApp: true,
        email: false,
        sms: false,
        push: true,
        digestFrequency: 'daily' as const,
      };
      apiSpy.put.and.returnValue(of(payload));
      service.updatePreferences(payload).subscribe((res) => {
        expect(res.digestFrequency).toBe('daily');
        done();
      });
    });
  });
});
