export interface MeQr {
  readonly studentPublicUuid: string | null;
  readonly issuedAt: string | null;
  readonly hasCredential: boolean;
  readonly svgDataUri: string | null;
}
