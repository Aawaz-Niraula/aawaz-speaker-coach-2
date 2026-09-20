import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';

import {
  ACCOUNT_EMAIL_MAX_LENGTH,
  ACCOUNT_NAME_MAX_LENGTH,
  ACCOUNT_PASSWORD_MAX_LENGTH,
  ACCOUNT_PASSWORD_MIN_LENGTH,
  ACCOUNT_PASSWORD_REQUIREMENTS,
  isValidAccountEmail,
  isValidAccountImage,
  isValidAccountName,
  isValidAccountPassword,
} from '@/lib/account-validation';
import { getAuthDb } from '@/lib/auth-db';
import { getTrustedOrigins } from '@/lib/origins';

function getAuthBaseURL() {
  if (process.env.BETTER_AUTH_URL) {
    const value = process.env.BETTER_AUTH_URL.replace(/\/$/, '');
    return value.endsWith('/api/auth') ? value : `${value}/api/auth`;
  }

  if (process.env.VERCEL_URL) {
    const origin = process.env.VERCEL_URL.startsWith('http')
      ? process.env.VERCEL_URL
      : `https://${process.env.VERCEL_URL}`;
    return `${origin.replace(/\/$/, '')}/api/auth`;
  }

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000/api/auth';
  }

  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _auth: any;

function badRequest(message: string): never {
  throw new APIError('BAD_REQUEST', { message });
}

function createAuth() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  return betterAuth({
    appName: 'Aawaz Speaker Coach',
    database: {
      db: getAuthDb()!,
      type: 'sqlite',
    },
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: getAuthBaseURL(),
    trustedOrigins: getTrustedOrigins(),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: ACCOUNT_PASSWORD_MIN_LENGTH,
      maxPasswordLength: ACCOUNT_PASSWORD_MAX_LENGTH,
      requireEmailVerification: false,
      autoSignIn: true,
    },
    emailVerification: {
      sendOnSignUp: false,
      sendOnSignIn: false,
    },
    socialProviders: googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {},
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        // Every authorization checks the database, including previously cached cookies.
        enabled: false,
      },
    },
    hooks: {
      /*
       * Field-level validation Better Auth does not do itself. It checks the
       * password length and that the email parses, but accepts a name or an
       * image URL of any length and any scheme. Everything a user can write
       * into the account tables is bounded here.
       */
      before: createAuthMiddleware(async (ctx) => {
        const body = (ctx.body ?? {}) as Record<string, unknown>;

        if (ctx.path === '/sign-up/email') {
          if (!isValidAccountPassword(body.password)) badRequest(ACCOUNT_PASSWORD_REQUIREMENTS);
          if (typeof body.email !== 'string' || body.email.length > ACCOUNT_EMAIL_MAX_LENGTH || !isValidAccountEmail(body.email)) {
            badRequest('Enter a valid email address.');
          }
          if (!isValidAccountName(body.name)) badRequest(`Name must be 1 to ${ACCOUNT_NAME_MAX_LENGTH} characters.`);
          if (body.image !== undefined && !isValidAccountImage(body.image)) badRequest('Profile image must be an https URL.');
          return;
        }

        if (ctx.path === '/sign-in/email') {
          if (typeof body.email !== 'string' || body.email.length > ACCOUNT_EMAIL_MAX_LENGTH) badRequest('Enter a valid email address.');
          if (typeof body.password !== 'string' || body.password.length > ACCOUNT_PASSWORD_MAX_LENGTH) badRequest('Invalid password.');
          return;
        }

        if (ctx.path === '/update-user') {
          if (body.name !== undefined && !isValidAccountName(body.name)) badRequest(`Name must be 1 to ${ACCOUNT_NAME_MAX_LENGTH} characters.`);
          if (body.image !== undefined && body.image !== null && !isValidAccountImage(body.image)) badRequest('Profile image must be an https URL.');
        }
      }),
    },
  });
}

export function getAuth(): ReturnType<typeof betterAuth> {
  if (!_auth) {
    _auth = createAuth();
  }
  return _auth;
}

/**
 * Lazily-initialized auth instance.
 * Uses a Proxy so the real betterAuth() call only happens at runtime
 * (when env vars are available), not at module-import time during
 * Next.js static page generation on Vercel.
 */
export const auth: ReturnType<typeof betterAuth> = new Proxy(
  {} as ReturnType<typeof betterAuth>,
  {
    get(_target, prop, receiver) {
      const instance = getAuth();
      const value = Reflect.get(instance, prop, receiver);
      if (typeof value === 'function') {
        return value.bind(instance);
      }
      return value;
    },
  },
);
