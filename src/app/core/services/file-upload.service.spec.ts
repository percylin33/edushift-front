import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { FileUploadService } from './file-upload.service';
import { of, throwError } from 'rxjs';

describe('FileUploadService', () => {
  let service: FileUploadService;
  let httpSpy: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    httpSpy = jasmine.createSpyObj('HttpClient', ['post']);

    TestBed.configureTestingModule({
      providers: [FileUploadService, { provide: HttpClient, useValue: httpSpy }],
    });
    service = TestBed.inject(FileUploadService);
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('requestUpload hace POST al endpoint correcto', () => {
    const mockTicket = {
      provider: 'FIREBASE',
      publicUuid: 'abc',
      uploadUrl: 'https://example.com',
      expiresAt: '2024-01-01',
      requiredHeaders: {},
    };
    httpSpy.post.and.returnValue(of({ data: mockTicket }));
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });

    service.requestUpload('avatars', file).subscribe((ticket) => {
      expect(ticket.provider).toBe('FIREBASE');
    });
  });

  it('uploadMultipart hace POST con FormData', () => {
    httpSpy.post.and.returnValue(of({ data: { publicUuid: 'abc' } as any }));
    const file = new File(['test'], 'test.txt');

    service.uploadMultipart('avatars', file).subscribe((meta) => {
      expect(meta.publicUuid).toBe('abc');
    });
  });

  it('uploadBytes lanza error cuando uploadUrl es null', () => {
    const ticket = {
      provider: 'LOCAL_FS',
      publicUuid: 'abc',
      uploadUrl: null,
      expiresAt: '',
      requiredHeaders: {},
    };
    service.uploadBytes(ticket, new File([''], 'test.txt')).subscribe({
      error: (err) => expect(err.message).toContain('uploadUrl is null'),
    });
  });
});
