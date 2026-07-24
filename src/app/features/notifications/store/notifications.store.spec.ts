import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiService } from '@core/services';
import { NotificationsStore } from './notifications.store';
import { NotificationItem } from '../models';

describe('NotificationsStore', () => {
  let store: NotificationsStore;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const base = {
    tenantId: 't-1',
    templateKey: 'TEACHER_ASSIGNED',
    category: 'SYSTEM' as const,
    channel: 'BOTH' as const,
    subject: 'Has sido asignado(a) — A',
    bodyHtml: '{"courseCode":"MAT","sectionName":"A"}',
    sentAt: '2026-07-22T10:00:00Z',
    createdAt: '2026-07-22',
    updatedAt: '2026-07-22',
  };

  const unreadRow: NotificationItem = {
    ...base,
    id: 'n1',
    publicUuid: 'p-1',
    status: 'SENT',
  };
  const readRow: NotificationItem = {
    ...base,
    id: 'n2',
    publicUuid: 'p-2',
    status: 'READ',
    readAt: '2026-07-22T10:05:00Z',
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'put', 'patch', 'delete']);
    TestBed.configureTestingModule({
      providers: [NotificationsStore, { provide: ApiService, useValue: apiSpy }],
    });
    store = TestBed.inject(NotificationsStore);
  });

  it('inicia con estado vacío', () => {
    expect(store.items()).toEqual([]);
    expect(store.unreadCount()).toBe(0);
    expect(store.preferences()).toBeNull();
    expect(store.loading()).toBeFalse();
    expect(store.error()).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Sprint 5C fix: the bell badge depends on unreadCount being correct
  // BEFORE the home page ever loads. The next two specs prove the
  // refreshUnreadCount path is the source of truth on cold start.
  // -------------------------------------------------------------------------

  describe('refreshUnreadCount (cold start)', () => {
    it('escribe unreadCount directamente del servidor, sin necesitar items', (done) => {
      // Backend returns the ApiResponse envelope; the store reads
      // res.data.unreadCount.
      apiSpy.get.and.returnValue(
        of({ success: true, data: { unreadCount: 7 }, timestamp: '2026-07-22' })
      );
      // items is empty (the bell is the FIRST consumer of the store).
      expect(store.items().length).toBe(0);

      store.refreshUnreadCount().subscribe(() => {
        expect(store.unreadCount()).toBe(7);
        expect(store.items().length).toBe(0); // still empty — bell didn't hydrate
        done();
      });
    });

    it('tolera errores de red → mantiene el valor previo', (done) => {
      apiSpy.get.and.returnValue(throwError(() => new Error('boom')));
      store['_unreadCount'].set(3); // simulate previous value

      store.refreshUnreadCount().subscribe(() => {
        expect(store.unreadCount()).toBe(3);
        done();
      });
    });

    it('reconcilia items cuando el servidor dice menos unread que la cache', (done) => {
      // Cache shows 3 unread, server says 1 → oldest 2 should be marked read.
      apiSpy.get.and.returnValue(
        of({ success: true, data: { unreadCount: 1 }, timestamp: '2026-07-22' })
      );
      store.setItems([
        { ...unreadRow, publicUuid: 'p-1', sentAt: '2026-07-22T10:00:00Z' },
        { ...unreadRow, publicUuid: 'p-2', sentAt: '2026-07-22T11:00:00Z' },
        { ...unreadRow, publicUuid: 'p-3', sentAt: '2026-07-22T12:00:00Z' },
      ]);

      store.refreshUnreadCount().subscribe(() => {
        expect(store.unreadCount()).toBe(1);
        const stillUnread = store.items().filter(
          (n) => !n.readAt && n.status !== 'READ'
        );
        expect(stillUnread.length).toBe(1);
        // The newest is preserved as unread (the conflict resolves to
        // "keep the newest unread when server says 1").
        expect(stillUnread[0].publicUuid).toBe('p-3');
        done();
      });
    });

    it('SPRINT5-CASCADE-FIX: si el BE devuelve un valor sin envelope, tolera 0', (done) => {
      // Defensive: if the BE accidentally drops the envelope and returns
      // the raw shape, the store must still not crash — just set 0.
      apiSpy.get.and.returnValue(of({ unreadCount: 7 }) as any);

      store.refreshUnreadCount().subscribe(() => {
        // serverCount = (res?.data?.unreadCount) ?? 0 = undefined ?? 0 = 0
        expect(store.unreadCount()).toBe(0);
        done();
      });
    });
  });

  // -------------------------------------------------------------------------
  // The home page populates the full list. unreadCount must agree with
  // the rows shown.
  // -------------------------------------------------------------------------

  describe('loadAll', () => {
    it('hidrata items y resincroniza unreadCount', (done) => {
      apiSpy.get.and.returnValue(
        of({
          success: true,
          data: [unreadRow, readRow, { ...unreadRow, publicUuid: 'p-3' }],
          meta: { total: 3, page: 0, size: 20 },
        })
      );

      store.loadAll().subscribe(() => {
        expect(store.items().length).toBe(3);
        expect(store.unreadCount()).toBe(2);
        expect(store.loading()).toBeFalse();
        done();
      });
    });

    it('captura error → loading=false y error seteado', (done) => {
      apiSpy.get.and.returnValue(throwError(() => new Error('boom')));

      store.loadAll().subscribe({
        complete: () => {
          expect(store.loading()).toBeFalse();
          expect(store.error()).toBeTruthy();
          done();
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  // markRead: optimistic decrement of unreadCount with rollback on fail.
  // -------------------------------------------------------------------------

  describe('markRead', () => {
    it('decrementa unreadCount inmediatamente', () => {
      apiSpy.patch.and.returnValue(of({ ...unreadRow, status: 'READ', readAt: '2026-07-22T10:10:00Z' }));
      store.setItems([unreadRow, unreadRow]);
      expect(store.unreadCount()).toBe(2);

      store.markRead('p-1').subscribe(() => {
        expect(store.items()[0].status).toBe('READ');
        expect(store.unreadCount()).toBe(1);
      });
    });

    it('revierte unreadCount si el backend falla', (done) => {
      apiSpy.patch.and.returnValue(throwError(() => new Error('boom')));
      store.setItems([unreadRow]);
      expect(store.unreadCount()).toBe(1);

      store.markRead('p-1').subscribe(() => {
        expect(store.items()[0].status).toBe('SENT');
        expect(store.unreadCount()).toBe(1);
        done();
      });
    });

    it('no decrementa si el row ya estaba leído', () => {
      apiSpy.patch.and.returnValue(of({ ...readRow }));
      store.setItems([readRow]);
      expect(store.unreadCount()).toBe(0);

      store.markRead('p-2').subscribe(() => {
        expect(store.unreadCount()).toBe(0);
      });
    });
  });

  describe('markAllRead', () => {
    it('setea unreadCount a 0', () => {
      store.setItems([unreadRow, unreadRow]);
      expect(store.unreadCount()).toBe(2);

      store.markAllRead();
      expect(store.unreadCount()).toBe(0);
      expect(store.items().every((n) => n.readAt)).toBeTrue();
    });
  });

  describe('reset', () => {
    it('limpia items y unreadCount', () => {
      store.setItems([unreadRow]);
      expect(store.unreadCount()).toBe(1);
      store.setError('err');
      store.reset();
      expect(store.items()).toEqual([]);
      expect(store.unreadCount()).toBe(0);
      expect(store.error()).toBeNull();
    });
  });
});
