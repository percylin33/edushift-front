import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { InviteUserModalComponent } from './invite-user-modal.component';
import { InvitationsStore } from '../store';
import { Invitation } from '../models';
import { InvitationStatus, UserRole } from '@core/enums';
import { DocumentType } from '@core/enums';
import { TenantService } from '@core/services';

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
    documentType: DocumentType.Dni,
    documentNumber: '87654321',
    fullName: 'A B',
    roles: [UserRole.Staff],
    status: InvitationStatus.Pending,
    token: 'tok-1',
    expiresAt: new Date('2026-12-31'),
  };

  function checkboxEvent(checked: boolean): Event {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    const event = new Event('change');
    Object.defineProperty(event, 'target', { value: input });
    return event;
  }

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
      providers: [
        { provide: InvitationsStore, useValue: fakeStore },
        { provide: TenantService, useValue: { tenantSlug: () => 'acme' } },
      ],
    });
    fixture = TestBed.createComponent(InviteUserModalComponent);
    component = fixture.componentInstance;
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('inicia con email/firstName vacíos y rol Staff por defecto', () => {
    configureModule();
    expect(component['email']()).toBe('');
    expect(component['firstName']()).toBe('');
    expect(component['lastName']()).toBe('');
    expect(component['selectedRoles']()).toEqual([UserRole.Staff]);
  });

  it('canSubmit requiere email + nombres + documento + roles', () => {
    configureModule();
    expect(component['canSubmit']()).toBeFalse();
    component['email'].set('a@b.com');
    component['firstName'].set('A');
    component['lastName'].set('B');
    component['documentNumber'].set('87654321');
    expect(component['canSubmit']()).toBeTrue();
    component['documentNumber'].set('123');
    expect(component['canSubmit']()).toBeFalse();
    component['documentNumber'].set('87654321');
    component['selectedRoles'].set([]);
    expect(component['canSubmit']()).toBeFalse();
  });

  it('acceptLink construye URL con origin y tenant del colegio', () => {
    configureModule();
    fakeStore.lastCreated.set(invitation);
    const link = component['acceptLink']() as string;
    expect(link).toContain('/invitation/tok-1');
    expect(new URL(link).hostname).toBe('acme.localhost');
  });

  it('acceptLink vacío si no hay token', () => {
    configureModule();
    fakeStore.lastCreated.set({ ...invitation, token: '' });
    expect(component['acceptLink']()).toBe('');
  });

  it('hasRole refleja selección', () => {
    configureModule();
    component['selectedRoles'].set([UserRole.Staff, UserRole.TenantAdmin]);
    expect(component['hasRole'](UserRole.Staff)).toBeTrue();
    expect(component['hasRole'](UserRole.Parent)).toBeFalse();
  });

  it('toggleRole agrega y quita roles', () => {
    configureModule();
    const evtTrue = checkboxEvent(true);
    component['toggleRole'](UserRole.TenantAdmin, evtTrue);
    expect(component['selectedRoles']()).toContain(UserRole.TenantAdmin);
    component['toggleRole'](UserRole.Teacher, evtTrue);
    expect(component['selectedRoles']()).not.toContain(UserRole.Teacher);
    const evtFalse = checkboxEvent(false);
    component['toggleRole'](UserRole.Staff, evtFalse);
    expect(component['selectedRoles']()).not.toContain(UserRole.Staff);
  });

  it('onSubmit llama store con payload limpio', async () => {
    configureModule();
    component['email'].set('a@b.com');
    component['firstName'].set('A');
    component['lastName'].set('B');
    component['documentNumber'].set('87654321');
    component['selectedRoles'].set([UserRole.Staff]);
    await component['onSubmit']();
    expect(fakeStore.create).toHaveBeenCalledWith({
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
      secondLastName: undefined,
      documentType: DocumentType.Dni,
      documentNumber: '87654321',
      roles: [UserRole.Staff],
    });
  });

  it('close limpia store y emite', () => {
    configureModule();
    const closedSpy = jasmine.createSpy('closed');
    component.closed.subscribe(closedSpy);
    component['close']();
    expect(fakeStore.clearLastCreated).toHaveBeenCalled();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(closedSpy).toHaveBeenCalled();
  });

  it('newAnother limpia lastCreated y reset form', () => {
    configureModule();
    component['email'].set('a@b.com');
    fakeStore.lastCreated.set(invitation);
    component['newAnother']();
    expect(fakeStore.clearLastCreated).toHaveBeenCalled();
    expect(component['email']()).toBe('');
  });

  it('copyLink setea justCopied si clipboard funciona', async () => {
    configureModule();
    fakeStore.lastCreated.set(invitation);
    spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.resolve());
    await component['copyLink']();
    expect(component['justCopied']()).toBeTrue();
  });

  it('copyLink silencioso si clipboard falla', async () => {
    configureModule();
    fakeStore.lastCreated.set(invitation);
    spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.reject('denied'));
    await component['copyLink']();
    expect(component['justCopied']()).toBeFalse();
  });

  it('formatDate formatea fecha en es', () => {
    configureModule();
    const formatted = component['formatDate'](new Date('2026-06-15'));
    expect(formatted).toContain('2026');
  });

  it('copyHint refleja justCopied', () => {
    configureModule();
    expect(component['copyHint']()).toContain('Copiar');
    component['justCopied'].set(true);
    expect(component['copyHint']()).toContain('Copiado');
  });
});
