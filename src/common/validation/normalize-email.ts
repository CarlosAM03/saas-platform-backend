/** Same canonical form used by the ADR-006 database migration. */
export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

export const transformEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? normalizeEmail(value) : value;
