/**
 * Predefined target table columns.
 * Used for field mapping destination options for Account entity.
 */
export const TARGET_COLUMNS_ACCOUNT: string[] = [
  "account_id",
  "account_name",
  "account_number",
  "billing_profile",
  "billing_street_address",
  "billing_city",
  "billing_state",
  "billing_zip_code",
  "contact_name",
  "email",
  "fax",
  "phone",
  "phone2",
  "phone3",
  "billing_notification",
  "service_notification",
];

export const REQUIRED_TARGET_COLUMNS_ACCOUNT: string[] = [
  "account_id",
  "account_name",
  "email",
];

const TARGET_COLUMNS_BY_ENTITY: { [key: string]: string[] } = {
  Account: TARGET_COLUMNS_ACCOUNT,
};

const REQUIRED_TARGET_COLUMNS_BY_ENTITY: { [key: string]: string[] } = {
  Account: REQUIRED_TARGET_COLUMNS_ACCOUNT,
};

export const PRIORITY_COLUMNS: string[] = [
  "account_id",
  "account_name",
  "account_number",
  "billing_profile",
  "billing_street_address",
  "billing_city",
  "billing_state",
  "billing_zip_code",
  "contact_name",
  "email",
  "fax",
  "phone",
  "phone2",
  "phone3",
  "billing_notification",
  "service_notification",
];

export function sortColumnsByPriority(cols: string[]): string[] {
  return [...cols].sort((a, b) => {
    const indexA = PRIORITY_COLUMNS.indexOf(a);
    const indexB = PRIORITY_COLUMNS.indexOf(b);

    // If both in priority, use their relative order in PRIORITY_COLUMNS
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    // If only A in priority, it comes first
    if (indexA !== -1) return -1;
    // If only B in priority, it comes first
    if (indexB !== -1) return 1;
    // If neither is in priority, sort alphabetically
    return a.localeCompare(b);
  });
}

export function getTargetColumnsForEntity(entity: string): string[] {
  return TARGET_COLUMNS_BY_ENTITY[entity] ?? TARGET_COLUMNS_ACCOUNT;
}

export function getRequiredTargetColumnsForEntity(entity: string): string[] {
  return (
    REQUIRED_TARGET_COLUMNS_BY_ENTITY[entity] ?? REQUIRED_TARGET_COLUMNS_ACCOUNT
  );
}
