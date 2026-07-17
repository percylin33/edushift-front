export interface AdminSeedUser {
  email: string;
  password: string;
  label: string;
}

export const SUPER_ADMIN: AdminSeedUser = {
  email: 'super@edushift.pe',
  password: 'SuperAdmin2026!',
  label: 'SUPER_ADMIN (edushift)',
};
