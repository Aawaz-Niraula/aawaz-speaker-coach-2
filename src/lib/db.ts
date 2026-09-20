import { createClient, type InStatement } from '@libsql/client';

type DbClient = ReturnType<typeof createClient>;

/*
 * created_at is always written as CURRENT_TIMESTAMP ("YYYY-MM-DD HH:MM:SS"),
 * which sorts correctly as plain text. Ordering by datetime(created_at) forced
 * a temp B-tree on every history read because the wrapped column cannot use
 * the (user_id, created_at DESC) index; ordering by the raw column uses it.
 */
const MAX_SESSIONS_PER_USER = 50;
const GUEST_FREE_ACTIONS = 3;

export class QuotaUnavailableError extends Error {
  constructor() {
    super('Usage protection is temporarily unavailable. Please try again shortly.');
    this.name = 'QuotaUnavailableError';
  }
}

let dbClient: DbClient | null | undefined;
let schemaReady = false;
let schemaReadyPromise: Promise<DbClient | null> | null = null;

/**
 * The one libsql client for the process.
 *
 * Created lazily, never at import time, and only when both the URL and the
 * auth token are present: there is no anonymous or local fallback, so the
 * database is unreachable rather than open when configuration is missing.
 * Better Auth's Kysely dialect wraps this same client (see auth-db.ts).
 */
export function getDbClient() {
  if (dbClient !== undefined) {
    return dbClient;
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    dbClient = null;
    return null;
  }

  dbClient = createClient({
    url,
    authToken,
  });

  return dbClient;
}

export type SpeechSessionRecord = {
  id: string;
  user_id: string;
  template_id: string | null;
  template_label: string | null;
  rubric_mode: string;
  transcript: string;
  feedback: string;
  overall_score: number | null;
  words_per_min: number | null;
  duration_seconds: number | null;
  /** Delivery report from the optional deep analysis. Null until requested. */
  deep_analysis: string | null;
  created_at: string;
};

/**
 * The columns the coaching prompts actually read. Fetching full records for
 * a summary pulled every transcript and delivery report over the wire on
 * each chat message; this carries a few hundred bytes per session instead.
 */
export type SpeechSessionSummary = {
  id: string;
  template_label: string | null;
  /** The opening of the report only, enough for a one-line recap. */
  feedback: string;
  overall_score: number | null;
  words_per_min: number | null;
  created_at: string;
};

/**
 * Every table the app uses, created in one round trip.
 *
 * Both the speech tables and the auth tables used to be prepared by separate
 * functions issuing a dozen sequential statements between them, all of which
 * ran on every cold start. One batch does the same work in a single request
 * and applies atomically.
 */
const SCHEMA_STATEMENTS: InStatement[] = [
  `CREATE TABLE IF NOT EXISTS speech_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    template_id TEXT,
    template_label TEXT,
    rubric_mode TEXT NOT NULL,
    transcript TEXT NOT NULL,
    feedback TEXT NOT NULL,
    overall_score INTEGER,
    words_per_min INTEGER,
    duration_seconds REAL,
    deep_analysis TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_speech_sessions_user_created
    ON speech_sessions (user_id, created_at DESC)`,
  // Scripts written in Speech Practice. Kept in its own table rather than
  // sharing speech_sessions, because a generated script has no recording,
  // no score, and no feedback — only a topic and the text.
  `CREATE TABLE IF NOT EXISTS generated_speeches (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    template_id TEXT,
    template_label TEXT,
    word_count INTEGER,
    speech TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_generated_speeches_user_created
    ON generated_speeches (user_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    userId TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_auth_session_user ON session (userId)`,
  `CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userId TEXT NOT NULL,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt TEXT,
    refreshTokenExpiresAt TEXT,
    scope TEXT,
    password TEXT,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_auth_account_user ON account (userId)`,
  `CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS guest_usage (
    guest_id TEXT PRIMARY KEY,
    action_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  // Daily per-user ceiling on the expensive routes. Keyed by
  // "<userId>:<action>:<YYYY-MM-DD>" so a day's counter is one row.
  `CREATE TABLE IF NOT EXISTS usage_quota (
    quota_key TEXT PRIMARY KEY,
    used INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  // Fixed-window counters shared by every server instance, for the limits
  // that must hold globally: login attempts above all. reset_at is epoch ms.
  `CREATE TABLE IF NOT EXISTS rate_limits (
    limit_key TEXT PRIMARY KEY,
    hits INTEGER NOT NULL DEFAULT 0,
    reset_at INTEGER NOT NULL
  )`,
];

export async function ensureSchema() {
  const db = getDbClient();

  if (!db || schemaReady) {
    return db;
  }

  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }

  schemaReadyPromise = (async () => {
    await db.batch(SCHEMA_STATEMENTS, 'write');

    // deep_analysis was added after launch. Databases created before then
    // need the column added; new ones already have it from CREATE TABLE.
    // ALTER TABLE has no IF NOT EXISTS, so this stays outside the batch
    // where its expected failure cannot abort the rest.
    await db.execute('ALTER TABLE speech_sessions ADD COLUMN deep_analysis TEXT').catch(() => null);

    schemaReady = true;
    return db;
  })().catch((error) => {
    schemaReadyPromise = null;
    console.error('Failed to prepare database schema:', error);
    return null;
  });

  return schemaReadyPromise;
}

/** Kept as names so call sites read naturally; both prepare the same schema. */
export const ensureSpeechSchema = ensureSchema;
export const ensureAuthSchema = ensureSchema;

/**
 * Daily per-user ceiling on the expensive AI routes.
 *
 * The in-process rate limiter only sees one serverless instance, so it cannot
 * hold a real quota — it is burst protection. This is the durable ceiling: one
 * shared counter per user per day, so a runaway client or a determined user
 * cannot turn into an unbounded provider bill.
 *
 * Generous enough that a genuine user practising hard will not notice.
 */
const DAILY_LIMITS: Record<string, number> = {
  'transcribe-analyze': 40,
  'deep-analysis': 20,
  'generate-speech': 40,
  // Tightest ceiling here: ElevenLabs charges per character, so a long script
  // synthesized repeatedly is by far the most expensive thing a user can do.
  // Twelve is several passes over a practice speech in one sitting.
  'generate-speech-audio': 12,
  'aawax-chat': 120,
  'generate-insights': 20,
  // Guests are counted per address as well as per cookie, because a guest
  // identity costs nothing to mint: without this, clearing the cookie was an
  // unlimited free tier. Sized for a household, not a data centre.
  'guest-actions': 60,
};

export async function consumeDailyQuota(userId: string, action: string) {
  const limit = DAILY_LIMITS[action];
  if (!limit) throw new QuotaUnavailableError();

  const db = await ensureSchema();
  if (!db) throw new QuotaUnavailableError();

  // UTC day. A rolling window would need a second column and buys little here.
  const day = new Date().toISOString().slice(0, 10);
  const key = `${userId}:${action}:${day}`;

  try {
    const result = await db.execute({
      sql: `
        INSERT INTO usage_quota (quota_key, used)
        VALUES (?, 1)
        ON CONFLICT(quota_key) DO UPDATE
          SET used = used + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE used < ?
        RETURNING used
      `,
      args: [key, limit],
    });

    const row = result.rows[0];
    if (!row) return { allowed: false, remaining: 0 };

    return { allowed: true, remaining: Math.max(0, limit - Number(row.used)) };
  } catch (error) {
    console.error('Failed to consume daily quota:', error);
    throw new QuotaUnavailableError();
  }
}

/** Drops quota rows from previous days so the table cannot grow unbounded. */
export async function pruneOldQuota() {
  const db = await ensureSchema();
  if (!db) return;

  const day = new Date().toISOString().slice(0, 10);
  try {
    await db.execute({
      sql: "DELETE FROM usage_quota WHERE quota_key NOT LIKE ?",
      args: [`%:${day}`],
    });
  } catch {
    // Best effort: stale rows are wasteful, not harmful.
  }
}

/**
 * Fixed-window counter shared across every instance.
 *
 * One atomic upsert: a fresh key or an expired window starts a new count of
 * one, an open window increments. Attempts over the limit still count, so a
 * client hammering a locked route does not shorten its own lockout. Returns
 * null when the database is unavailable so the caller can fail closed.
 */
export async function consumeDurableRateLimit(key: string, limit: number, windowMs: number) {
  const db = await ensureSchema();
  if (!db) return null;

  const now = Date.now();
  const resetAt = now + windowMs;

  try {
    const result = await db.execute({
      sql: `
        INSERT INTO rate_limits (limit_key, hits, reset_at)
        VALUES (?, 1, ?)
        ON CONFLICT(limit_key) DO UPDATE SET
          hits = CASE WHEN rate_limits.reset_at <= ? THEN 1 ELSE rate_limits.hits + 1 END,
          reset_at = CASE WHEN rate_limits.reset_at <= ? THEN ? ELSE rate_limits.reset_at END
        RETURNING hits, reset_at
      `,
      args: [key, resetAt, now, now, resetAt],
    });

    const row = result.rows[0];
    if (!row) return null;

    const hits = Number(row.hits);
    const windowEnds = Number(row.reset_at);

    // Occasional sweep of expired windows; the table would otherwise keep a
    // row for every address that ever signed in.
    if (Math.random() < 0.02) {
      void db.execute({ sql: 'DELETE FROM rate_limits WHERE reset_at < ?', args: [now] }).catch(() => null);
    }

    return {
      allowed: hits <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil((windowEnds - now) / 1000)),
    };
  } catch (error) {
    console.error('Failed to consume durable rate limit:', error);
    return null;
  }
}

/** Forgets a durable counter, e.g. an account's failed-login tally after a success. */
export async function resetDurableRateLimit(key: string) {
  const db = await ensureSchema();
  if (!db) return;

  await db.execute({ sql: 'DELETE FROM rate_limits WHERE limit_key = ?', args: [key] }).catch(() => null);
}

export async function consumeGuestUsage(guestId: string) {
  const db = await ensureSchema();

  if (!db) {
    throw new QuotaUnavailableError();
  }

  try {
    /* One statement, not three.
     *
     * This used to insert, read the count, then write count+1. Two requests
     * from the same guest arriving together both read the same value and both
     * wrote the same increment, so the limit leaked a free action — and it
     * cost three round trips on every guest AI call.
     *
     * The upsert increments only while the count is under the cap, and
     * RETURNING gives us the post-increment value, so the decision and the
     * write are the same atomic operation.
     */
    const result = await db.execute({
      sql: `
        INSERT INTO guest_usage (guest_id, action_count)
        VALUES (?, 1)
        ON CONFLICT(guest_id) DO UPDATE
          SET action_count = action_count + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE action_count < ?
        RETURNING action_count
      `,
      args: [guestId, GUEST_FREE_ACTIONS],
    });

    const row = result.rows[0];
    if (!row) {
      // The WHERE guard blocked the update: this guest is at the cap.
      return { allowed: false, remaining: 0 };
    }

    const count = Number(row.action_count);
    return { allowed: true, remaining: Math.max(0, GUEST_FREE_ACTIONS - count) };
  } catch (error) {
    console.error('Failed to consume guest usage:', error);
    throw new QuotaUnavailableError();
  }
}

/**
 * Moves a guest's sessions and scripts onto an account and retires the guest
 * allowance. Keep a spent counter so replaying a saved cookie cannot reset it.
 * One transaction: either the whole identity moves or none of it.
 */
export async function mergeGuestDataIntoUser(guestId: string, userId: string) {
  const db = await ensureSchema();

  if (!db || !guestId || !userId || guestId === userId) {
    return false;
  }

  try {
    await db.batch([
      { sql: 'UPDATE speech_sessions SET user_id = ? WHERE user_id = ?', args: [userId, guestId] },
      { sql: 'UPDATE generated_speeches SET user_id = ? WHERE user_id = ?', args: [userId, guestId] },
      {
        sql: `INSERT INTO guest_usage (guest_id, action_count) VALUES (?, ?)
              ON CONFLICT(guest_id) DO UPDATE SET action_count = ?, updated_at = CURRENT_TIMESTAMP`,
        args: [guestId, GUEST_FREE_ACTIONS, GUEST_FREE_ACTIONS],
      },
    ], 'write');

    return true;
  } catch (error) {
    console.error('Failed to merge guest data into user:', error);
    return false;
  }
}

/**
 * Reads the score the standard analysis gave this session.
 * The delivery report anchors to it so the two numbers cannot contradict
 * each other. Scoped by user_id, like every other session read.
 */
export async function getSpeechSessionScore(sessionId: string, userId: string) {
  const db = await ensureSchema();
  if (!db) return null;

  try {
    const result = await db.execute({
      sql: 'SELECT overall_score FROM speech_sessions WHERE id = ? AND user_id = ? LIMIT 1',
      args: [sessionId, userId],
    });

    const row = result.rows[0];
    return row?.overall_score === null || row?.overall_score === undefined
      ? null
      : Number(row.overall_score);
  } catch (error) {
    console.error('Failed to read session score:', error);
    return null;
  }
}

/**
 * Attaches a delivery report to an existing session.
 * Scoped by user_id so a session can only ever be updated by its owner.
 */
export async function updateSpeechSessionDeepAnalysis(sessionId: string, userId: string, report: string) {
  const db = await ensureSchema();
  if (!db) return false;

  try {
    const result = await db.execute({
      sql: `
        UPDATE speech_sessions
        SET deep_analysis = ?
        WHERE id = ? AND user_id = ?
      `,
      args: [report, sessionId, userId],
    });

    return result.rowsAffected > 0;
  } catch (error) {
    console.error('Failed to save deep analysis:', error);
    return false;
  }
}

const SESSION_COLUMNS = `id, user_id, template_id, template_label, rubric_mode, transcript, feedback,
               overall_score, words_per_min, duration_seconds, deep_analysis, created_at`;

const SESSION_LIST_SQL = `
  SELECT ${SESSION_COLUMNS}
  FROM speech_sessions
  WHERE user_id = ?
  ORDER BY created_at DESC
  LIMIT ?
`;

function clampLimit(limit: number, max: number) {
  return Math.min(max, Math.max(1, Math.round(Number.isFinite(limit) ? limit : 1)));
}

function mapSessionRow(row: Record<string, unknown>): SpeechSessionRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    template_id: row.template_id ? String(row.template_id) : null,
    template_label: row.template_label ? String(row.template_label) : null,
    rubric_mode: String(row.rubric_mode),
    transcript: String(row.transcript),
    feedback: String(row.feedback),
    overall_score: row.overall_score === null ? null : Number(row.overall_score),
    words_per_min: row.words_per_min === null ? null : Number(row.words_per_min),
    duration_seconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    deep_analysis: row.deep_analysis ? String(row.deep_analysis) : null,
    created_at: String(row.created_at),
  };
}

export async function listRecentSpeechSessions(userId: string, limit = 6) {
  const db = await ensureSchema();

  if (!db) {
    return [];
  }

  try {
    const result = await db.execute({
      sql: SESSION_LIST_SQL,
      args: [userId, clampLimit(limit, 25)],
    });

    return result.rows.map((row) => mapSessionRow(row as Record<string, unknown>));
  } catch (error) {
    console.error('Failed to list speech sessions:', error);
    return [];
  }
}

/**
 * The lightweight read for prompts that only need scores and a one-line
 * recap. The report text is cut in the database, so the transfer is bounded
 * whatever a session's report grew to.
 */
export async function listSpeechSessionSummaries(userId: string, limit = 12, feedbackChars = 400): Promise<SpeechSessionSummary[]> {
  const db = await ensureSchema();
  if (!db) return [];

  try {
    const result = await db.execute({
      sql: `
        SELECT id, template_label, substr(feedback, 1, ?) AS feedback,
               overall_score, words_per_min, created_at
        FROM speech_sessions
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `,
      args: [clampLimit(feedbackChars, 2000), userId, clampLimit(limit, 50)],
    });

    return result.rows.map((row) => ({
      id: String(row.id),
      template_label: row.template_label ? String(row.template_label) : null,
      feedback: String(row.feedback ?? ''),
      overall_score: row.overall_score === null ? null : Number(row.overall_score),
      words_per_min: row.words_per_min === null ? null : Number(row.words_per_min),
      created_at: String(row.created_at),
    }));
  } catch (error) {
    console.error('Failed to list speech session summaries:', error);
    return [];
  }
}

// deep_analysis is optional on insert: the standard pipeline never sets it, and
// it is filled in later only if the user asks for a deeper read.
export async function insertSpeechSession(session: Omit<SpeechSessionRecord, 'created_at' | 'deep_analysis'> & { deep_analysis?: string | null }) {
  const db = await ensureSchema();

  if (!db) {
    return false;
  }

  try {
    // Insert and trim in one transaction: the row lands and the user's
    // oldest sessions beyond the cap go in the same round trip.
    await db.batch([
      {
        sql: `
          INSERT INTO speech_sessions (
            id, user_id, template_id, template_label, rubric_mode, transcript, feedback,
            overall_score, words_per_min, duration_seconds, deep_analysis
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          session.id,
          session.user_id,
          session.template_id,
          session.template_label,
          session.rubric_mode,
          session.transcript,
          session.feedback,
          session.overall_score,
          session.words_per_min,
          session.duration_seconds,
          session.deep_analysis ?? null,
        ],
      },
      {
        sql: `
          DELETE FROM speech_sessions
          WHERE user_id = ?
            AND id NOT IN (
              SELECT id
              FROM speech_sessions
              WHERE user_id = ?
              ORDER BY created_at DESC
              LIMIT ?
            )
        `,
        args: [session.user_id, session.user_id, MAX_SESSIONS_PER_USER],
      },
    ], 'write');

    return true;
  } catch (error) {
    console.error('Failed to insert speech session:', error);
    return false;
  }
}

export type GeneratedSpeechRecord = {
  id: string;
  user_id: string;
  topic: string;
  template_id: string | null;
  template_label: string | null;
  word_count: number | null;
  speech: string;
  created_at: string;
};

/** Saves a generated script, trimming the user's oldest beyond the cap. */
export async function insertGeneratedSpeech(record: Omit<GeneratedSpeechRecord, 'created_at'>) {
  const db = await ensureSchema();
  if (!db) return false;

  try {
    await db.batch([
      {
        sql: `
          INSERT INTO generated_speeches (id, user_id, topic, template_id, template_label, word_count, speech)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          record.id,
          record.user_id,
          record.topic,
          record.template_id,
          record.template_label,
          record.word_count,
          record.speech,
        ],
      },
      {
        sql: `
          DELETE FROM generated_speeches
          WHERE user_id = ?
            AND id NOT IN (
              SELECT id FROM generated_speeches
              WHERE user_id = ?
              ORDER BY created_at DESC
              LIMIT ?
            )
        `,
        args: [record.user_id, record.user_id, MAX_SESSIONS_PER_USER],
      },
    ], 'write');

    return true;
  } catch (error) {
    console.error('Failed to save generated speech:', error);
    return false;
  }
}

const GENERATED_LIST_SQL = `
  SELECT id, user_id, topic, template_id, template_label, word_count, speech, created_at
  FROM generated_speeches
  WHERE user_id = ?
  ORDER BY created_at DESC
  LIMIT ?
`;

function mapGeneratedRow(row: Record<string, unknown>): GeneratedSpeechRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    topic: String(row.topic),
    template_id: row.template_id ? String(row.template_id) : null,
    template_label: row.template_label ? String(row.template_label) : null,
    word_count: row.word_count === null ? null : Number(row.word_count),
    speech: String(row.speech),
    created_at: String(row.created_at),
  };
}

export async function listGeneratedSpeeches(userId: string, limit = 20) {
  const db = await ensureSchema();
  if (!db) return [];

  try {
    const result = await db.execute({
      sql: GENERATED_LIST_SQL,
      args: [userId, clampLimit(limit, MAX_SESSIONS_PER_USER)],
    });

    return result.rows.map((row) => mapGeneratedRow(row as Record<string, unknown>));
  } catch (error) {
    console.error('Failed to list generated speeches:', error);
    return [];
  }
}

export async function deleteGeneratedSpeech(userId: string, speechId: string) {
  const db = await ensureSchema();
  if (!db) return false;

  try {
    const result = await db.execute({
      sql: 'DELETE FROM generated_speeches WHERE id = ? AND user_id = ?',
      args: [speechId, userId],
    });
    return result.rowsAffected > 0;
  } catch (error) {
    console.error('Failed to delete generated speech:', error);
    return false;
  }
}

/**
 * Deletes a script and returns what remains, in one round trip. The delete
 * routes always answer with the refreshed list, so the read rides along.
 */
export async function deleteGeneratedSpeechAndList(userId: string, speechId: string, limit = 20) {
  const db = await ensureSchema();
  if (!db) return { deleted: false, speeches: [] as GeneratedSpeechRecord[] };

  try {
    const [deleteResult, listResult] = await db.batch([
      { sql: 'DELETE FROM generated_speeches WHERE id = ? AND user_id = ?', args: [speechId, userId] },
      { sql: GENERATED_LIST_SQL, args: [userId, clampLimit(limit, MAX_SESSIONS_PER_USER)] },
    ], 'write');

    return {
      deleted: deleteResult.rowsAffected > 0,
      speeches: listResult.rows.map((row) => mapGeneratedRow(row as Record<string, unknown>)),
    };
  } catch (error) {
    console.error('Failed to delete generated speech:', error);
    return { deleted: false, speeches: [] as GeneratedSpeechRecord[] };
  }
}

export async function deleteSpeechSession(userId: string, sessionId: string) {
  const db = await ensureSchema();

  if (!db) {
    return false;
  }

  try {
    const result = await db.execute({
      sql: `
        DELETE FROM speech_sessions
        WHERE id = ? AND user_id = ?
      `,
      args: [sessionId, userId],
    });

    return result.rowsAffected > 0;
  } catch (error) {
    console.error('Failed to delete speech session:', error);
    return false;
  }
}

/** Deletes a session and returns the refreshed history, in one round trip. */
export async function deleteSpeechSessionAndList(userId: string, sessionId: string, limit = 6) {
  const db = await ensureSchema();
  if (!db) return { deleted: false, history: [] as SpeechSessionRecord[] };

  try {
    const [deleteResult, listResult] = await db.batch([
      { sql: 'DELETE FROM speech_sessions WHERE id = ? AND user_id = ?', args: [sessionId, userId] },
      { sql: SESSION_LIST_SQL, args: [userId, clampLimit(limit, 25)] },
    ], 'write');

    return {
      deleted: deleteResult.rowsAffected > 0,
      history: listResult.rows.map((row) => mapSessionRow(row as Record<string, unknown>)),
    };
  } catch (error) {
    console.error('Failed to delete speech session:', error);
    return { deleted: false, history: [] as SpeechSessionRecord[] };
  }
}

/**
 * Removes every speech record a user owns, atomically.
 *
 * The voice-sample table belongs to a feature that no longer exists, but old
 * databases may still carry it. It cannot join the batch, because a missing
 * table would abort the whole transaction, so it is swept separately first.
 */
export async function deleteUserSpeechData(userId: string) {
  const db = await ensureSchema();
  if (!db) return false;

  await db.execute({ sql: 'DELETE FROM speech_voice_samples WHERE user_id = ?', args: [userId] }).catch(() => null);

  await db.batch([
    { sql: 'DELETE FROM speech_sessions WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM generated_speeches WHERE user_id = ?', args: [userId] },
  ], 'write');

  return true;
}

/**
 * Deletes an account and everything attached to it in one transaction, so
 * a failure part-way can never leave credentials behind without their user
 * or a user without their data wiped.
 *
 * session and account declare ON DELETE CASCADE, but SQLite only honours that
 * when PRAGMA foreign_keys is ON, so the children are deleted explicitly.
 * verification rows are keyed by email, not userId, so the cascade would never
 * reach them anyway.
 */
export async function deleteUserAccount(userId: string, email: string | null | undefined) {
  const db = await ensureSchema();
  if (!db) return false;

  await db.execute({ sql: 'DELETE FROM speech_voice_samples WHERE user_id = ?', args: [userId] }).catch(() => null);

  const statements: InStatement[] = [
    { sql: 'DELETE FROM speech_sessions WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM generated_speeches WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM session WHERE userId = ?', args: [userId] },
    { sql: 'DELETE FROM account WHERE userId = ?', args: [userId] },
  ];

  if (email) {
    statements.push({ sql: 'DELETE FROM verification WHERE identifier = ?', args: [email] });
  }

  statements.push({ sql: 'DELETE FROM user WHERE id = ?', args: [userId] });

  await db.batch(statements, 'write');

  return true;
}
