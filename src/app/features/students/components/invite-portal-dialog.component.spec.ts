import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { TenantService } from '@core/services';
import { InvitePortalDialogComponent } from './invite-portal-dialog.component';
import { StudentsStore } from '../store/students.store';
import { PortalInvitationResult } from '../models';

interface PortalTenantFixture {
  name: string;
  slug: string;
  settings?: Record<string, unknown>;
  branding?: { primaryColor: string; logo?: { light?: string | null } };
}
describe('InvitePortalDialogComponent', () => {
  let fixture: ComponentFixture<InvitePortalDialogComponent>;
  let component: InvitePortalDialogComponent;
  let store: {
    invitingPortal: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    clearLastPortalInvitation: jasmine.Spy;
    clearError: jasmine.Spy;
    inviteStudent: jasmine.Spy;
    inviteGuardian: jasmine.Spy;
    resendInvitation: jasmine.Spy;
  };
  let tenant: {
    tenant: WritableSignal<PortalTenantFixture | null>;
    tenantSlug: jasmine.Spy;
  };

  const studentUuid = 'student-test-uuid';
  const guardianUuid = 'guardian-test-uuid';
  const expiresAt = new Date('2026-11-02T17:30:00.000Z');

  function setup(): void {
    store = {
      invitingPortal: signal(false),
      error: signal<string | null>(null),
      clearLastPortalInvitation: jasmine.createSpy('clearLastPortalInvitation'),
      clearError: jasmine.createSpy('clearError'),
      inviteStudent: jasmine.createSpy('inviteStudent').and.resolveTo(null),
      inviteGuardian: jasmine.createSpy('inviteGuardian').and.resolveTo(null),
      resendInvitation: jasmine.createSpy('resendInvitation').and.resolveTo(null),
    };
    tenant = {
      tenant: signal<PortalTenantFixture | null>({
        name: 'Jardín de Prueba',
        slug: 'jardin-prueba',
        settings: { credentialHandout: { welcomeTitle: 'Bienvenida de prueba' } },
        branding: { primaryColor: '#1769aa' },
      }),
      tenantSlug: jasmine.createSpy('tenantSlug').and.returnValue('jardin-prueba'),
    };

    TestBed.configureTestingModule({
      imports: [InvitePortalDialogComponent],
      providers: [
        { provide: StudentsStore, useValue: store },
        { provide: TenantService, useValue: tenant },
      ],
    });
    fixture = TestBed.createComponent(InvitePortalDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('personName', 'Alma Demo');
    fixture.componentRef.setInput('email', 'alma.demo.12345678.abcdef@slud-del-colegio.com');
    fixture.componentRef.setInput('studentPublicUuid', studentUuid);
    fixture.detectChanges();
  }

  it('solo muestra al tutor pendiente cuando el estudiante ya tiene portal y reenvía ese enlace', async () => {
    setup();
    const result: PortalInvitationResult = {
      invitationPublicUuid: 'invite-new',
      invitationToken: 'guardian-token',
      email: 'maria.perez.87654321.a1b2c3@slud-del-colegio.com',
      expiresAt,
    };
    store.resendInvitation.and.resolveTo(result);
    fixture.componentRef.setInput('studentAndGuardian', true);
    fixture.componentRef.setInput('studentAlreadyActive', true);
    fixture.componentRef.setInput('studentName', 'Alma Demo');
    fixture.componentRef.setInput('additionalGuardian', {
      fullName: 'María Pérez',
      email: result.email,
      guardianPublicUuid: guardianUuid,
      pendingInvitationPublicUuid: 'invite-old',
    });
    fixture.detectChanges();

    const textBeforeInvite = fixture.nativeElement.textContent as string;
    expect(textBeforeInvite).toContain(
      'Solo prepararemos el acceso pendiente del tutor principal.',
    );
    expect(textBeforeInvite).toContain('Tutor principal · María Pérez');
    expect(textBeforeInvite).not.toContain('alma.demo.12345678.abcdef@slud-del-colegio.com');
    expect(component['hasSyntheticPendingAccount']()).toBeTrue();

    await component['onConfirm']();
    fixture.detectChanges();

    expect(store.inviteStudent).not.toHaveBeenCalled();
    expect(store.resendInvitation).toHaveBeenCalledOnceWith('invite-old', studentUuid);
    expect(fixture.nativeElement.textContent).toContain('Invitación lista');
    expect(component['whatsappMessage']()).toContain('guardian-token');
    expect(component['whatsappMessage']()).toContain('Válido hasta:');
  });

  it('la hoja de bienvenida usa la marca del colegio y muestra la caducidad del enlace', () => {
    setup();
    const printedDocument = {
      write: jasmine.createSpy('write'),
      close: jasmine.createSpy('close'),
    };
    const printWindow = {
      document: printedDocument,
      opener: window,
      focus: jasmine.createSpy('focus'),
      print: jasmine.createSpy('print'),
    };
    spyOn(window, 'open').and.returnValue(printWindow as unknown as WindowProxy);
    component['invitationLinks'].set([
      {
        label: 'Acceso del tutor',
        personName: 'María Pérez',
        email: 'maria.perez.87654321.a1b2c3@slud-del-colegio.com',
        url: 'https://jardin-prueba.example/accept?token=guardian-token',
        expiresAt,
      },
    ]);

    component['printWelcome']();

    const html = printedDocument.write.calls.mostRecent().args[0] as string;
    expect(html).toContain('Jardín de Prueba');
    expect(html).toContain('Bienvenida de prueba');
    expect(html).toContain('https://jardin-prueba.example/accept?token=guardian-token');
    expect(html).toContain('Enlace válido hasta:');
    expect(printedDocument.close).toHaveBeenCalled();
    expect(printWindow.print).toHaveBeenCalled();
  });
});
