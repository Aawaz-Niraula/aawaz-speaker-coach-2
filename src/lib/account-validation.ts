export const ACCOUNT_PASSWORD_MIN_LENGTH = 6;
export const ACCOUNT_PASSWORD_MAX_LENGTH = 128;
export const ACCOUNT_PASSWORD_REQUIREMENTS =
  'Password must be 6–128 characters and include at least one letter and one number.';

/** RFC 5321 caps a mailbox address at 254 characters. */
export const ACCOUNT_EMAIL_MAX_LENGTH = 254;
export const ACCOUNT_NAME_MAX_LENGTH = 100;
export const ACCOUNT_IMAGE_MAX_LENGTH = 2048;

export function normalizeAccountEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidAccountEmail(email: string) {
  const normalized = normalizeAccountEmail(email);
  return normalized.length <= ACCOUNT_EMAIL_MAX_LENGTH && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function isValidAccountPassword(password: unknown) {
  return typeof password === 'string'
    && password.length >= ACCOUNT_PASSWORD_MIN_LENGTH
    && password.length <= ACCOUNT_PASSWORD_MAX_LENGTH
    && /[A-Za-z]/.test(password)
    && /\d/.test(password);
}

/** A display name: non-empty once trimmed, bounded, and no control characters. */
export function isValidAccountName(name: unknown) {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= ACCOUNT_NAME_MAX_LENGTH && !/[\x00-\x1f\x7f]/.test(trimmed);
}

/**
 * A profile image must be an https URL of sane length. Rejecting every other
 * scheme keeps javascript: and data: out of a value the UI hands to an <img>.
 */
export function isValidAccountImage(image: unknown) {
  if (typeof image !== 'string' || image.length > ACCOUNT_IMAGE_MAX_LENGTH) return false;
  try {
    return new URL(image).protocol === 'https:';
  } catch {
    return false;
  }
}
