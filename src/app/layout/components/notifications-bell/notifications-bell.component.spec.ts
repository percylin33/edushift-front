import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationsBellComponent } from './notifications-bell.component';
import { provideRouter } from '@angular/router';

describe('NotificationsBellComponent', () => {
  let component: NotificationsBellComponent;
  let fixture: ComponentFixture<NotificationsBellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationsBellComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsBellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('route está definida', () => {
    expect(component.route).toBeDefined();
  });
});
