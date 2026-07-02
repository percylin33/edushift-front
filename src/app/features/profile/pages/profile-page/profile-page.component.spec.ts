import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ChangeDetectionStrategy } from '@angular/core';

import { environment } from '@env/environment';
import { AuthService } from '@core/services';

import { ProfilePageComponent } from './profile-page.component';

describe('ProfilePageComponent', () => {
  let fixture: ComponentFixture<ProfilePageComponent>;
  let component: ProfilePageComponent;
  let httpMock: HttpTestingController;
  let auth: AuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfilePageComponent, HttpClientTestingModule],
      providers: [provideRouter([])],
    })
      .overrideComponent(ProfilePageComponent, {
        set: { changeDetection: ChangeDetectionStrategy.Default },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ProfilePageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('rejects an oversize avatar client-side (no request fired)', () => {
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    // Simulate the change event directly
    const fakeInput = { target: { files: [big], value: '' } } as unknown as Event;
    component.onFileSelected(fakeInput);

    httpMock.expectNone((r) => r.url.endsWith('/users/me/avatar'));
    expect(component.avatarError()).toMatch(/excede el tamaño máximo/i);
  });

  it('rejects a non-image avatar client-side (no request fired)', () => {
    const doc = new File([new Uint8Array(100)], 'doc.pdf', { type: 'application/pdf' });
    component.onFileSelected({ target: { files: [doc], value: '' } } as unknown as Event);

    httpMock.expectNone((r) => r.url.endsWith('/users/me/avatar'));
    expect(component.avatarError()).toMatch(/formato no soportado/i);
  });

  it('uploads a valid avatar and updates the local state on 201', () => {
    // Pre-seed the cached user so the page can render.
    auth.setUser({
      publicUuid: 'me-uuid',
      fullName: 'Alice Demo',
      email: 'alice@acme.test',
      status: 'ACTIVE',
    } as any);

    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'avatar.png', {
      type: 'image/png',
    });
    component.onFileSelected({ target: { files: [png], value: '' } } as unknown as Event);

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiUrl}/${environment.apiVersion}/users/me/avatar` &&
        r.method === 'POST',
    );
    req.flush({ success: true, data: { publicUuid: 'new-avatar' }, message: null, timestamp: '' });
    fixture.detectChanges();

    expect(component.avatarMessage()).toMatch(/avatar actualizado/i);
    expect(auth.user()?.avatarUrl).toBe('new-avatar');
  });
});
