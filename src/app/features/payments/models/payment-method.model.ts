export type PaymentMethodType = 'BANK_TRANSFER' | 'YAPE' | 'PLIN' | 'CASH';

export interface PaymentMethodAdminResponse {
  publicUuid: string;
  methodType: PaymentMethodType;
  displayName: string | null;
  bankName: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
  cci: string | null;
  walletPhone: string | null;
  walletQrUrl: string | null;
  active: boolean;
  defaultMethod: boolean;
}

export interface PaymentMethodPublicResponse {
  publicUuid: string;
  methodType: PaymentMethodType;
  displayName: string | null;
  bankName: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
  cci: string | null;
  walletPhone: string | null;
  walletQrUrl: string | null;
  defaultMethod: boolean;
}

export interface PaymentMethodCreateRequest {
  methodType: PaymentMethodType;
  displayName?: string | null;
  bankName?: string | null;
  accountHolder?: string | null;
  accountNumber: string;
  cci?: string | null;
  walletPhone?: string | null;
  walletQrUrl?: string | null;
}

export interface PaymentMethodUpdateRequest {
  displayName?: string | null;
  bankName?: string | null;
  accountHolder?: string | null;
  accountNumber?: string | null;
  cci?: string | null;
  walletPhone?: string | null;
  walletQrUrl?: string | null;
  active?: boolean | null;
}

export const PAYMENT_METHOD_TYPE_LABELS: Record<PaymentMethodType, string> = {
  BANK_TRANSFER: 'Transferencia bancaria',
  YAPE: 'Yape',
  PLIN: 'Plin',
  CASH: 'Efectivo',
};

export const PAYMENT_METHOD_TYPE_ICONS: Record<PaymentMethodType, string> = {
  BANK_TRANSFER: '🏦',
  YAPE: '📱',
  PLIN: '📱',
  CASH: '💵',
};

const PAYMENT_METHOD_TYPE_IMAGES: Partial<Record<PaymentMethodType, string>> = {
  YAPE: '/payments/methods/yape.png',
  PLIN: '/payments/methods/plin.png',
};

const BANK_LOGO_IMAGES = [
  { match: /\bbcp\b|banco\s+de\s+cr[eé]dito/i, src: '/payments/methods/bcp.png' },
  { match: /interbank/i, src: '/payments/methods/interbank.png' },
] as const;

export function getMethodTypeLabel(type: PaymentMethodType): string {
  return PAYMENT_METHOD_TYPE_LABELS[type] ?? type;
}

export function getMethodTypeIcon(type: PaymentMethodType): string {
  return PAYMENT_METHOD_TYPE_ICONS[type] ?? '❓';
}

export function getPaymentMethodImage(
  type: PaymentMethodType,
  bankName?: string | null,
): string | null {
  if (type === 'BANK_TRANSFER' && bankName) {
    return BANK_LOGO_IMAGES.find(({ match }) => match.test(bankName))?.src ?? null;
  }

  return PAYMENT_METHOD_TYPE_IMAGES[type] ?? null;
}
