import type { IconName } from '@shared/components/icon/icons.registry';

export interface PromptDialogConfig {
  title: string;
  message: string;
  inputLabel?: string;
  inputPlaceholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  icon?: IconName;
  inputType?: 'text' | 'password';
}
