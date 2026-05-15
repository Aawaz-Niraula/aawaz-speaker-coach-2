import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';

import { getAuthDb } from '@/lib/auth-db';

function passwordHasLetterAndNumber(password: unknown) {
  return typeof password === 'string' && /[A-Za-z]/.test(password) && /\d/.test(password);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _auth: any;

function createAuth() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  return betterAuth({
    appName: 'Aawaz Speaker Coach',
    database: getAuthDb()!,
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      maxPasswordLength: 128,
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
        enabled: true,
        maxAge: 60 * 5,
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/sign-up/email') {
          return;
        }

        if (!passwordHasLetterAndNumber(ctx.body?.password)) {
          throw new APIError('BAD_REQUEST', {
            message: 'Password must include at least one letter and one number.',
          });
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
