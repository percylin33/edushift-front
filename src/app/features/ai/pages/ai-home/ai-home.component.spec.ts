import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AiHomeComponent } from './ai-home.component';

describe('AiHomeComponent', () => {
  let component: AiHomeComponent;
  let fixture: ComponentFixture<AiHomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiHomeComponent],
      providers: [provideHttpClient()],
    }).compileComponents();
    fixture = TestBed.createComponent(AiHomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('tiene rutas de asistentes', () => {
    expect(component.routes.TUTOR).toBe('/ai/tutor');
    expect(component.routes.TEACHER).toBe('/ai/teacher');
  });
});
