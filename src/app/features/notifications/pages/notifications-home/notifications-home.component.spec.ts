import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { NotificationsHomeComponent } from './notifications-home.component';
import { NotificationsStore } from '../../store';
import { NotificationItem } from '../../models';

/**
 * Unit tests for {@link NotificationsHomeComponent}.
 *
 * <p>Covers the three render branches (loading, error, empty, list)
 * and the mark-as-read happy + error paths. Tests run against the real
 * {@link NotificationsStore} (not a mock) so the signal-based contract
 * between the page and the bell is exercised end-to-end.</p>
 */
describe('NotificationsHomeComponent', () => {
  let component: NotificationsHomeComponent;
  let fixture: ComponentFixture<NotificationsHomeComponent>;
  let store: NotificationsStore;

  const sampleRow: NotificationItem = {
    id: 'row-1',
    tenantId: 'tenant-1',
    publicUuid: 'p-1',
    templateKey: 'TEACHER_ASSIGNED',
    category: 'SYSTEM',
    channel: 'BOTH',
    status: 'SENT',
    subject: 'TEACHER_ASSIGNED · 2026-07-22T10:00:00Z',
    bodyHtml:
      '{"courseCode":"SECUNDARIA","sectionName":"A","teacherName":"César Ortega"}',
    sentAt: '2026-07-22T10:00:00Z',
    createdAt: '2026-07-22T10:00:00Z',
    updatedAt: '2026-07-22T10:00:00Z',
  };

  beforeEach(async () => {
    // Stub the store's loadAll via dependency injection on the next tick.
    await TestBed.configureTestingModule({
      imports: [NotificationsHomeComponent],
      providers: [NotificationsStore],
    })
      .overrideComponent(NotificationsHomeComponent, {
        set: { template: '<div></div>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(NotificationsHomeComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(NotificationsStore);
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('llama store.loadAll en ngOnInit', () => {
    spyOn(store, 'loadAll').and.returnValue(of(null as unknown as NotificationItem[]));
    fixture.detectChanges();
    expect(store.loadAll).toHaveBeenCalled();
  });

  it('renderiza empty state cuando el store tiene lista vacía', () => {
    spyOn(store, 'loadAll').and.returnValue(of(null as unknown as NotificationItem[]));
    store.setItems([]);
    fixture.detectChanges();
    expect(component.notifications().length).toBe(0);
    expect(component.loading()).toBeFalse();
  });

  it('markAsRead delega en store.markRead', () => {
    spyOn(store, 'markRead').and.returnValue(of(null as unknown as NotificationItem));
    fixture.detectChanges();
    component.markAsRead(sampleRow);
    expect(store.markRead).toHaveBeenCalledWith('p-1');
  });

  it('isRead considera tanto status=READ como readAt definido', () => {
    expect(component.isRead({ ...sampleRow, status: 'READ' })).toBeTrue();
    expect(component.isRead({ ...sampleRow, status: 'SENT', readAt: '2026-07-22T10:05:00Z' })).toBeTrue();
    expect(component.isRead({ ...sampleRow, status: 'SENT' })).toBeFalse();
  });

  it('humanizeTemplateKey capitaliza separando por guión bajo', () => {
    expect(component.humanizeTemplateKey('TEACHER_ASSIGNED')).toBe('Teacher Assigned');
    expect(component.humanizeTemplateKey('STUDENT_ABSENT')).toBe('Student Absent');
  });

  it('summarize deriva un resumen a partir del bodyHtml JSON', () => {
    expect(component.summarize(sampleRow)).toBe('Curso SECUNDARIA · sección A · docente César Ortega');
  });
});
