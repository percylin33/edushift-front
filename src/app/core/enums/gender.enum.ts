/**
 * Self-reported gender for a student. Mirrors the backend {@code Gender}
 * enum verbatim. {@code NotSpecified} is the default and the value the
 * platform falls back to when the institution does not collect this
 * datum or the family declined to share it. Treat as administrative
 * metadata only — the platform never gates features on gender.
 */
export enum Gender {
  Male = 'MALE',
  Female = 'FEMALE',
  Other = 'OTHER',
  NotSpecified = 'NOT_SPECIFIED',
}
