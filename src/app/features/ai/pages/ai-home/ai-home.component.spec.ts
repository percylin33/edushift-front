import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiHomeComponent } from './ai-home.component';

describe('AiHomeComponent', () => {
  let component: AiHomeComponent;
  let fixture: ComponentFixture<AiHomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiHomeComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AiHomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('tiene enlace a chat', () => {
    expect(component.chatLink).toBeDefined();
    expect(typeof component.chatLink).toBe('string');
  });
});
