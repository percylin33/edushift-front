import { environment } from '@env/environment';

export const APP = {
  NAME: environment.appName,
  VERSION: environment.appVersion,
  DEFAULT_LOCALE: environment.defaultLocale,
  SUPPORTED_LOCALES: environment.supportedLocales,
} as const;
