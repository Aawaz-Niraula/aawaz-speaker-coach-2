import { LibsqlDialect } from '@libsql/kysely-libsql';
import { Kysely } from 'kysely';

let authDb: Kysely<Record<string, unknown>> | null | undefined;

export function getAuthDb() {
  if (authDb !== undefined) {
    return authDb;
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    authDb = null;
    return null;
  }

  authDb = new Kysely<Record<string, unknown>>({
    dialect: new LibsqlDialect({
      url,
      authToken,
    }),
  });

  return authDb;
}
