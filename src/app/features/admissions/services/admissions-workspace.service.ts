import { Injectable } from '@angular/core';

/** In-memory navigation context; personal records are never persisted to browser storage. */
@Injectable({ providedIn: 'root' })
export class AdmissionsWorkspaceService {
  year = '';
  applicationPage = 0;
  inquiryPage = 0;
  applicationScroll = 0;
  inquiryScroll = 0;
  applicationSearch = '';
  applicationStatus = 'ALL';
  applicationGrade = '';
  inquirySearch = '';
  inquiryStatus = 'ALL';
  inquiryGrade = '';
}
