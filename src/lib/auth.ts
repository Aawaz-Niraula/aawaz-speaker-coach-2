import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';

import { getAuthDb } from '@/lib/auth-db';

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

function passwordHasLetterAndNumber(password: unknown) {
  return typeof password === 'string' && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export const auth = betterAuth({
  appName: 'Aawaz Speaker Coach',
  database: getAuthDb() ?? undefined,
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
