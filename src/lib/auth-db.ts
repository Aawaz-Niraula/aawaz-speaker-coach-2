import { LibsqlDialect, type LibsqlDialectConfig } from '@libsql/kysely-libsql';
import { Kysely } from 'kysely';

import { getDbClient } from '@/lib/db';

let authDb: Kysely<Record<string, unknown>> | null | undefined;

/**
 * Kysely handle for Better Auth.
 *
 * Built on the same libsql client as the rest of the app rather than opening
 * a second one: two clients meant two connection pools, two auth handshakes
 * on every cold start, and two places a token could go stale.
 */
export function getAuthDb() {
  if (authDb) {
    return authDb;
  }

  const client = getDbClient();
  if (!client) {
    return null;
  }

  // The dialect pins an older @libsql/client for its typings, whose Client
  // differs from ours only in the return type of sync(). The runtime surface
  // the dialect uses (execute, batch, transaction) is identical.
  type DialectClient = Extract<LibsqlDialectConfig, { client: unknown }>['client'];

  authDb = new Kysely<Record<string, unknown>>({
    dialect: new LibsqlDialect({ client: client as unknown as DialectClient }),
  });

  return authDb;
}
