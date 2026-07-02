import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { InviteTeacherDialogComponent } from './invite-teacher-dialog.component';
import { TeacherDetail, TeacherInvitationResult } from '../models';
import { DocumentType, EmploymentStatus } from '@core/enums';
import { TeachersStore } from '../store';

class FakeTeachersStore {
  lastInvitation = signal<TeacherInvitationResult | null>(null);
  inviting = signal(false);
  error = signal<string | null>(null);

  clearLastInvitation() {
    this.lastInvitation.set(null);
  }
  clearError() {
    this.error.set(null);
  }

  async invite(publicUuid: string): Promise<TeacherInvitationResult | null> {
    return null;
  }
}

describe('InviteTeacherDialogComponent', () => {
  let component: InviteTeacherDialogComponent;
  let fixture: ComponentFixture<InviteTeacherDialogComponent>;
  let store: FakeTeachersStore;

  const mockTeacher: TeacherDetail = {
    publicUuid: 't-1',
    documentType: DocumentType.Dni,
    documentNumber: '87654321',
    firstName: 'Maria',
    lastName: 'Gomez',
    fullName: 'Maria Gomez',
    email: 'maria@school.com',
    employmentStatus: EmploymentStatus.Active,
    specializations: [],
    hasUserAccount: false,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const mockInvitation: TeacherInvitationResult = {
    invitationPublicUuid: 'inv-1',
    invitationToken: 'token-abc',
    expiresAt: new Date('2026-02-01'),
    teacherPublicUuid: 't-1',
    email: 'maria@school.com',
  };

  beforeEach(async () => {
    store = new FakeTeachersStore();
    await TestBed.configureTestingModule({
      imports: [InviteTeacherDialogComponent],
      providers: [{ provide: TeachersStore, useValue: store as any }],
    }).compileComponents();

    fixture = TestBed.createComponent(InviteTeacherDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('teacher', mockTeacher);
    fixture.detectChanges();
  });

  it('se crea con estado confirm (sin invitación)', () => {
    expect(component).toBeTruthy();
    expect(store.lastInvitation()).toBeNull();
  });

  it('no tiene email = botón deshabilitado', () => {
    fixture.componentRef.setInput('teacher', { ...mockTeacher, email: undefined });
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('footer button:last-child');
    expect(btn.disabled).toBeTrue();
  });

  it('hasEmail es true cuando teacher tiene email', () => {
    expect(component['hasEmail']()).toBeTrue();
  });

  it('onConfirm llama store.invite', async () => {
    const inviteSpy = spyOn(store, 'invite').and.returnValue(Promise.resolve(mockInvitation));
    const invitedSpy = spyOn(component.invited, 'emit');

    await component['onConfirm']();
    expect(inviteSpy).toHaveBeenCalledWith('t-1');
    expect(invitedSpy).toHaveBeenCalledWith(mockInvitation);
  });

  it('close emite closed y limpia estado', () => {
    const closedSpy = spyOn(component.closed, 'emit');
    store.lastInvitation.set(mockInvitation);

    component['close']();

    expect(store.lastInvitation()).toBeNull();
    expect(closedSpy).toHaveBeenCalled();
  });

  it('muestra estado success cuando hay invitación', () => {
    store.lastInvitation.set(mockInvitation);
    fixture.detectChanges();

    const title = fixture.nativeElement.querySelector('h2');
    expect(title.textContent).toContain('Invitación enviada');
  });

  it('acceptLink construye URL correcta', () => {
    store.lastInvitation.set(mockInvitation);
    const link = component['acceptLink']();
    expect(link).toContain('/invitation/token-abc');
  });

  it('formatDate formatea en español', () => {
    const date = new Date('2026-02-01T12:00:00Z');
    const formatted = component['formatDate'](date);
    expect(formatted).toContain('2026');
  });
});
