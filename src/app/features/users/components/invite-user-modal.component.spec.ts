import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { InviteUserModalComponent } from './invite-user-modal.component';
import { InvitationsStore } from '../store';
import { Invitation } from '../models';
import { InvitationStatus, UserRole } from '@core/enums';

describe('InviteUserModalComponent', () => {
  let fixture: ComponentFixture<InviteUserModalComponent>;
  let component: InviteUserModalComponent;
  let fakeStore: {
    lastCreated: ReturnType<typeof signal<Invitation | null>>;
    saving: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    clearLastCreated: jasmine.Spy;
    clearError: jasmine.Spy;
    create: jasmine.Spy;
  };

  const invitation: Invitation = {
    publicUuid: 'inv-1',
    email: 'a@b.com',
    firstName: 'A',
    lastName: 'B',
    fullName: 'A B',
    roles: [UserRole.Teacher],
    status: InvitationStatus.Pending,
    token: 'tok-1',
    expiresAt: new Date('2026-12-31'),
  };

  function configureModule(): void {
    fakeStore = {
      lastCreated: signal<Invitation | null>(null),
      saving: signal(false),
      error: signal<string | null>(null),
      clearLastCreated: jasmine.createSpy('clearLastCreated'),
      clearError: jasmine.createSpy('clearError'),
      create: jasmine.createSpy('create').and.returnValue(Promise.resolve(invitation)),
    };
    TestBed.configureTestingModule({
      imports: [InviteUserModalComponent],
      providers: [{ provide: InvitationsStore, useValue: fakeStore }],
    });
    fixture = TestBed.createComponent(InviteUserModalComponent);
    component = fixture.componentInstance;
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('inicia con email/firstName vacíos y rol Teacher por defecto', () => {
    configureModule();
    expect((component as any).email()).toBe('');
    expect((component as any).firstName()).toBe('');
    expect((component as any).lastName()).toBe('');
    expect((component as any).selectedRoles()).toEqual([UserRole.Teacher]);
  });

  it('canSubmit requiere email + nombres + roles', () => {
    configureModule();
    expect((component as any).canSubmit()).toBeFalse();
    (component as any).email.set('a@b.com');
    (component as any).firstName.set('A');
    (component as any).lastName.set('B');
    expect((component as any).canSubmit()).toBeTrue();
    (component as any).selectedRoles.set([]);
    expect((component as any).canSubmit()).toBeFalse();
  });

  it('acceptLink construye URL con origin', () => {
    configureModule();
    fakeStore.lastCreated.set(invitation);
    expect((component as any).acceptLink()).toContain('/invitation/tok-1');
  });

  it('acceptLink vacío si no hay token', () => {
    configureModule();
    fakeStore.lastCreated.set({ ...invitation, token: null });
    expect((component as any).acceptLink()).toBe('');
  });

  it('hasRole refleja selección', () => {
    configureModule();
    (component as any).selectedRoles.set([UserRole.Teacher, UserRole.Staff]);
    expect((component as any).hasRole(UserRole.Teacher)).toBeTrue();
    expect((component as any).hasRole(UserRole.Guardian)).toBeFalse();
  });

  it('toggleRole agrega y quita roles', () => {
    configureModule();
    const evtTrue = { target: { checked: true } } as any;
    (component as any).toggleRole(UserRole.Guardian, evtTrue);
    expect((component as any).selectedRoles()).toContain(UserRole.Guardian);
    const evtFalse = { target: { checked: false } } as any;
    (component as any).toggleRole(UserRole.Teacher, evtFalse);
    expect((component as any).selectedRoles()).not.toContain(UserRole.Teacher);
  });

  it('onSubmit llama store con payload limpio', async () => {
    configureModule();
    (component as any).email.set('a@b.com');
    (component as any).firstName.set('A');
    (component as any).lastName.set('B');
    (component as any).selectedRoles.set([UserRole.Teacher]);
    await (component as any).onSubmit();
    expect(fakeStore.create).toHaveBeenCalledWith({
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
      roles: [UserRole.Teacher],
    });
  });

  it('close limpia store y emite', () => {
    configureModule();
    const closedSpy = jasmine.createSpy('closed');
    component.closed.subscribe(closedSpy);
    (component as any).close();
    expect(fakeStore.clearLastCreated).toHaveBeenCalled();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(closedSpy).toHaveBeenCalled();
  });

  it('newAnother limpia lastCreated y reset form', () => {
    configureModule();
    (component as any).email.set('a@b.com');
    fakeStore.lastCreated.set(invitation);
    (component as any).newAnother();
    expect(fakeStore.clearLastCreated).toHaveBeenCalled();
    expect((component as any).email()).toBe('');
  });

  it('copyLink setea justCopied si clipboard funciona', async () => {
    configureModule();
    fakeStore.lastCreated.set(invitation);
    spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.resolve());
    await (component as any).copyLink();
    expect((component as any).justCopied()).toBeTrue();
  });

  it('copyLink silencioso si clipboard falla', async () => {
    configureModule();
    fakeStore.lastCreated.set(invitation);
    spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.reject('denied'));
    await (component as any).copyLink();
    expect((component as any).justCopied()).toBeFalse();
  });

  it('formatDate formatea fecha en es', () => {
    configureModule();
    const formatted = (component as any).formatDate(new Date('2026-06-15'));
    expect(formatted).toContain('2026');
  });

  it('copyHint refleja justCopied', () => {
    configureModule();
    expect((component as any).copyHint()).toContain('Copiar');
    (component as any).justCopied.set(true);
    expect((component as any).copyHint()).toContain('Copiado');
  });
});
