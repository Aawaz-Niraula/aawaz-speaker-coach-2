import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_PASSWORD_MAX_LENGTH,
  isValidAccountEmail,
  isValidAccountPassword,
  normalizeAccountEmail,
} from './account-validation';

describe('account email validation', () => {
  it('normalizes whitespace and case before authentication', () => {
    expect(normalizeAccountEmail('  Speaker@Example.COM ')).toBe('speaker@example.com');
  });

  it.each([
    'speaker@example.com',
    'first.last+practice@sub.example.org',
  ])('accepts %s', (email) => {
    expect(isValidAccountEmail(email)).toBe(true);
  });

  it.each([
    '',
    'not-an-email',
    'missing-domain@',
    '@example.com',
    'space here@example.com',
  ])('rejects %s', (email) => {
    expect(isValidAccountEmail(email)).toBe(false);
  });
});

describe('account password validation', () => {
  it.each(['abc123', 'Aawaz2026!', '1letter'])('accepts a valid password', (password) => {
    expect(isValidAccountPassword(password)).toBe(true);
  });

  it.each(['A1', 'lettersOnly', '12345678', '', null, undefined])('rejects an invalid password', (password) => {
    expect(isValidAccountPassword(password)).toBe(false);
  });

  it('rejects passwords over the server limit', () => {
    expect(isValidAccountPassword(`A1${'x'.repeat(ACCOUNT_PASSWORD_MAX_LENGTH - 1)}`)).toBe(false);
  });
});
