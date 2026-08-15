import { createClient } from '@libsql/client';

type DbClient = ReturnType<typeof createClient>;

/*
 * created_at is always written as CURRENT_TIMESTAMP ("YYYY-MM-DD HH:MM:SS"),
 * which sorts correctly as plain text. Ordering by datetime(created_at) forced
 * a temp B-tree on every history read because the wrapped column cannot use
 * the (user_id, created_at DESC) index; ordering by the raw column uses it.
 */
const MAX_SESSIONS_PER_USER = 50;
const GUEST_FREE_ACTIONS = 3;

let dbClient: DbClient | null | undefined;
let schemaReady = false;
let schemaReadyPromise: Promise<DbClient | null> | null = null;
let authSchemaReady = false;
let authSchemaReadyPromise: Promise<DbClient | null> | null = null;

function getDbClient() {
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

export async function ensureSpeechSchema() {
  const db = getDbClient();

  if (!db || schemaReady) {
    return db;
  }

  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }

  schemaReadyPromise = (async () => {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS speech_sessions (
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
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Added after launch: nullable so existing rows and the standard analysis
    // pipeline are unaffected. Only populated when a user asks to go deeper.
    await db.execute('ALTER TABLE speech_sessions ADD COLUMN deep_analysis TEXT').catch(() => null);

    // Scripts written in Speech Practice. Kept in its own table rather than
    // sharing speech_sessions, because a generated script has no recording,
    // no score, and no feedback — only a topic and the text.
    await db.execute(`
      CREATE TABLE IF NOT EXISTS generated_speeches (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        topic TEXT NOT NULL,
        template_id TEXT,
        template_label TEXT,
        word_count INTEGER,
        speech TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_generated_speeches_user_created
      ON generated_speeches (user_id, created_at DESC)
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_speech_sessions_user_created
      ON speech_sessions (user_id, created_at DESC)
    `);

    schemaReady = true;
    return db;
  })().catch((error) => {
    schemaReadyPromise = null;
    console.error('Failed to prepare speech history schema:', error);
    return null;
  });

  return schemaReadyPromise;
}

export async function ensureAuthSchema() {
  const db = getDbClient();

  if (!db || authSchemaReady) {
    return db;
  }

  if (authSchemaReadyPromise) {
    return authSchemaReadyPromise;
  }

  authSchemaReadyPromise = (async () => {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        emailVerified INTEGER NOT NULL DEFAULT 0,
        image TEXT,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        userId TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        ipAddress TEXT,
        userAgent TEXT,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
      )
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_auth_session_user
      ON session (userId)
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS account (
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
      )
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_auth_account_user
      ON account (userId)
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS verification (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS guest_usage (
        guest_id TEXT PRIMARY KEY,
        action_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Daily per-user ceiling on the expensive routes. Keyed by
    // "<userId>:<action>:<YYYY-MM-DD>" so a day's counter is one row.
    await db.execute(`
      CREATE TABLE IF NOT EXISTS usage_quota (
        quota_key TEXT PRIMARY KEY,
        used INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    authSchemaReady = true;
    return db;
  })().catch((error) => {
    authSchemaReadyPromise = null;
    console.error('Failed to prepare auth schema:', error);
    return null;
  });

  return authSchemaReadyPromise;
}

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
};

export async function consumeDailyQuota(userId: string, action: string) {
  const limit = DAILY_LIMITS[action];
  if (!limit) return { allowed: true, remaining: null as number | null };

  const db = await ensureAuthSchema();
  // Never block a real user because the counter is unavailable.
  if (!db) return { allowed: true, remaining: null };

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
    return { allowed: true, remaining: null };
  }
}

/** Drops quota rows from previous days so the table cannot grow unbounded. */
export async function pruneOldQuota() {
  const db = await ensureAuthSchema();
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

export async function consumeGuestUsage(guestId: string) {
  const db = await ensureAuthSchema();

  if (!db) {
    return { allowed: true, remaining: GUEST_FREE_ACTIONS };
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
    // Never block a real user because the counter is unavailable.
    return { allowed: true, remaining: GUEST_FREE_ACTIONS };
  }
}

export async function mergeGuestDataIntoUser(guestId: string, userId: string) {
  const db = await ensureSpeechSchema();
  await ensureAuthSchema();

  if (!db || !guestId || !userId || guestId === userId) {
    return false;
  }

  try {
    await db.execute({
      sql: `
        UPDATE speech_sessions
        SET user_id = ?
        WHERE user_id = ?
      `,
      args: [userId, guestId],
    });

    // Scripts written as a guest follow the account too.
    await db.execute({
      sql: 'UPDATE generated_speeches SET user_id = ? WHERE user_id = ?',
      args: [userId, guestId],
    }).catch(() => null);

    await db.execute({
      sql: `
        DELETE FROM guest_usage
        WHERE guest_id = ?
      `,
      args: [guestId],
    });

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
  const db = await ensureSpeechSchema();
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
  const db = await ensureSpeechSchema();
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

export async function listRecentSpeechSessions(userId: string, limit = 6) {
  const db = await ensureSpeechSchema();

  if (!db) {
    return [];
  }

  try {
    const result = await db.execute({
      sql: `
        SELECT id, user_id, template_id, template_label, rubric_mode, transcript, feedback,
               overall_score, words_per_min, duration_seconds, deep_analysis, created_at
        FROM speech_sessions
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `,
      args: [userId, Math.min(25, Math.max(1, Math.round(limit)))],
    });

    return result.rows.map((row) => ({
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
    })) as SpeechSessionRecord[];
  } catch (error) {
    console.error('Failed to list speech sessions:', error);
    return [];
  }
}

// deep_analysis is optional on insert: the standard pipeline never sets it, and
// it is filled in later only if the user asks for a deeper read.
export async function insertSpeechSession(session: Omit<SpeechSessionRecord, 'created_at' | 'deep_analysis'> & { deep_analysis?: string | null }) {
  const db = await ensureSpeechSchema();

  if (!db) {
    return false;
  }

  try {
    await db.execute({
      sql: `
        INSERT INTO speech_sessions (
          id, user_id, template_id, template_label, rubric_mode, transcript, feedback,
          overall_score, words_per_min, duration_seconds
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      ],
    });

    await db.execute({
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
    });

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
  const db = await ensureSpeechSchema();
  if (!db) return false;

  try {
    await db.execute({
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
    });

    await db.execute({
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
    });

    return true;
  } catch (error) {
    console.error('Failed to save generated speech:', error);
    return false;
  }
}

export async function listGeneratedSpeeches(userId: string, limit = 20) {
  const db = await ensureSpeechSchema();
  if (!db) return [];

  try {
    const result = await db.execute({
      sql: `
        SELECT id, user_id, topic, template_id, template_label, word_count, speech, created_at
        FROM generated_speeches
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `,
      args: [userId, limit],
    });

    return result.rows.map((row) => ({
      id: String(row.id),
      user_id: String(row.user_id),
      topic: String(row.topic),
      template_id: row.template_id ? String(row.template_id) : null,
      template_label: row.template_label ? String(row.template_label) : null,
      word_count: row.word_count === null ? null : Number(row.word_count),
      speech: String(row.speech),
      created_at: String(row.created_at),
    })) as GeneratedSpeechRecord[];
  } catch (error) {
    console.error('Failed to list generated speeches:', error);
    return [];
  }
}

export async function deleteGeneratedSpeech(userId: string, speechId: string) {
  const db = await ensureSpeechSchema();
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

export async function deleteSpeechSession(userId: string, sessionId: string) {
  const db = await ensureSpeechSchema();

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
