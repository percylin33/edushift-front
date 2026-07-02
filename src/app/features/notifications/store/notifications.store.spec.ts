import { TestBed } from '@angular/core/testing';
import { NotificationsStore } from './notifications.store';
import { NotificationItem } from '../models';

describe('NotificationsStore', () => {
  let store: NotificationsStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [NotificationsStore] });
    store = TestBed.inject(NotificationsStore);
  });

  it('inicia con estado vacío', () => {
    expect(store.items()).toEqual([]);
    expect(store.preferences()).toBeNull();
    expect(store.loading()).toBeFalse();
    expect(store.error()).toBeNull();
    expect(store.unreadCount()).toBe(0);
  });

  describe('setItems', () => {
    it('establece items', () => {
      const items: NotificationItem[] = [
        {
          id: 'n1',
          channel: 'in_app',
          severity: 'info',
          title: 'Test',
          body: 'Cuerpo',
          createdAt: '',
          updatedAt: '',
        },
      ];
      store.setItems(items);
      expect(store.items().length).toBe(1);
    });
  });

  describe('unreadCount', () => {
    it('calcula no leídas', () => {
      const items: NotificationItem[] = [
        {
          id: 'n1',
          channel: 'in_app',
          severity: 'info',
          title: 'A',
          body: '',
          createdAt: '',
          updatedAt: '',
          readAt: undefined,
        },
        {
          id: 'n2',
          channel: 'in_app',
          severity: 'info',
          title: 'B',
          body: '',
          createdAt: '',
          updatedAt: '',
          readAt: '2026-01-01',
        },
      ];
      store.setItems(items);
      expect(store.unreadCount()).toBe(1);
    });
  });

  describe('markRead', () => {
    it('marca una notificación como leída', () => {
      store.setItems([
        {
          id: 'n1',
          channel: 'in_app',
          severity: 'info',
          title: 'T',
          body: '',
          createdAt: '',
          updatedAt: '',
        },
      ]);
      store.markRead('n1');
      expect(store.items()[0].readAt).toBeDefined();
      expect(store.unreadCount()).toBe(0);
    });
  });

  describe('markAllRead', () => {
    it('marca todas como leídas', () => {
      store.setItems([
        {
          id: 'n1',
          channel: 'in_app',
          severity: 'info',
          title: 'A',
          body: '',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'n2',
          channel: 'in_app',
          severity: 'info',
          title: 'B',
          body: '',
          createdAt: '',
          updatedAt: '',
        },
      ]);
      store.markAllRead();
      expect(store.unreadCount()).toBe(0);
      expect(store.items().every((n) => n.readAt)).toBeTrue();
    });
  });

  describe('reset', () => {
    it('reinicia estado', () => {
      store.setItems([
        {
          id: 'n1',
          channel: 'in_app',
          severity: 'info',
          title: 'T',
          body: '',
          createdAt: '',
          updatedAt: '',
        },
      ]);
      store.setError('err');
      store.reset();
      expect(store.items()).toEqual([]);
      expect(store.error()).toBeNull();
    });
  });
});
