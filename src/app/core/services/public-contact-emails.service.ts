import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { API } from '@core/constants';

export interface PublicContactEmails {
  supportEmail: string;
  privacyEmail: string;
  legalEmail: string;
}

interface ApiResponse<T> {
  data: T;
}

const DEFAULT_CONTACT_EMAILS: PublicContactEmails = {
  supportEmail: 'soporte@edushift.pe',
  privacyEmail: 'privacidad@edushift.pe',
  legalEmail: 'legales@edushift.pe',
};

@Injectable({ providedIn: 'root' })
export class PublicContactEmailsService {
  private readonly http = inject(HttpClient);
  readonly emails = signal<PublicContactEmails>(DEFAULT_CONTACT_EMAILS);

  constructor() {
    this.http.get<ApiResponse<PublicContactEmails>>(API.PUBLIC_CONTACT).subscribe({
      next: (response) => this.emails.set(response.data),
    });
  }
}
