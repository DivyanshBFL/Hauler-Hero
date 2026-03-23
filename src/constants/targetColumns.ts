/**
 * Predefined target table columns.
 * Used for field mapping destination options for Account entity.
 */
export const TARGET_COLUMNS_ACCOUNT: string[] = [
  'account_id',
  'account_name',
  'account_number',
  'billing_profile',
  'billing_street_address',
  'billing_city',
  'billing_state',
  'billing_zip_code',
  'contact_name',
  'email',
  'fax',
  'phone',
  'phone2',
  'phone3',
  'billing_notification',
  'service_notification',
];

export const REQUIRED_TARGET_COLUMNS_ACCOUNT: string[] = [
  'account_id',
  'account_name',
  'email',
];

const TARGET_COLUMNS_BY_ENTITY: { [key: string]: string[] } = {
  Account: TARGET_COLUMNS_ACCOUNT,
};

const REQUIRED_TARGET_COLUMNS_BY_ENTITY: { [key: string]: string[] } = {
  Account: REQUIRED_TARGET_COLUMNS_ACCOUNT,
};

export function getTargetColumnsForEntity(entity: string): string[] {
  return TARGET_COLUMNS_BY_ENTITY[entity] ?? TARGET_COLUMNS_ACCOUNT;
}

export function getRequiredTargetColumnsForEntity(entity: string): string[] {
  return REQUIRED_TARGET_COLUMNS_BY_ENTITY[entity] ?? REQUIRED_TARGET_COLUMNS_ACCOUNT;
}