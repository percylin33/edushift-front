import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FamilyApiService } from '@features/family/services/family-api.service';
import { FileUploadService } from '@core/services/file-upload.service';
import { AgentChatService } from '../../services/agent-chat.service';
import { AgentChatComponent } from './agent-chat.component';

describe('AgentChatComponent', () => {
  let fixture: ComponentFixture<AgentChatComponent>;
  let api: jasmine.SpyObj<AgentChatService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<AgentChatService>('AgentChatService', [
      'listSessions', 'createSession', 'messages', 'send',
    ]);
    api.listSessions.and.returnValue(of([]));
    api.messages.and.returnValue(of([]));
    api.send.and.returnValue({ events$: of(), cancel: () => undefined });

    await TestBed.configureTestingModule({
      imports: [AgentChatComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { routeConfig: { path: 'teacher' } } } },
        { provide: AgentChatService, useValue: api },
        { provide: FamilyApiService, useValue: jasmine.createSpyObj('FamilyApiService', ['listChildren']) },
        { provide: FileUploadService, useValue: jasmine.createSpyObj('FileUploadService', ['downloadAndSave']) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentChatComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('envía el formulario sin permitir la recarga nativa de la página', () => {
    const component = fixture.componentInstance;
    component.currentSession.set({
      publicUuid: 'session-1', agentType: 'TEACHER', subjectPublicUuid: null,
      title: 'Nueva', messageCount: 0, updatedAt: '',
    });
    component.draft.setValue('Hola');
    fixture.detectChanges();

    const event = new Event('submit', { bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector('form').dispatchEvent(event);

    expect(event.defaultPrevented).toBeTrue();
    expect(api.send).toHaveBeenCalledWith('TEACHER', 'session-1', 'Hola');
  });

  it('conserva el texto del usuario cuando falla el proveedor para permitir reintentar', () => {
    const component = fixture.componentInstance;
    component.currentSession.set({
      publicUuid: 'session-1', agentType: 'TEACHER', subjectPublicUuid: null,
      title: 'Nueva', messageCount: 0, updatedAt: '',
    });
    component.draft.setValue('Ayúdame con mi clase');
    api.send.and.returnValue({
      events$: of({ kind: 'error', code: 'LLM_FAILURE', message: 'No se pudo completar la respuesta.' }),
      cancel: () => undefined,
    });

    component.send();

    expect(component.draft.value).toBe('Ayúdame con mi clase');
    expect(component.error()).toBe('No se pudo completar la respuesta.');
    expect(component.streaming()).toBeFalse();
  });
});
