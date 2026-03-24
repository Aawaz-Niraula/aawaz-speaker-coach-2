import { createClient } from '@libsql/client';

let schemaReady = false;

function getDbClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    return null;
  }

  return createClient({
    url,
    authToken,
  });
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
  created_at: string;
};

export async function ensureSpeechSchema() {
  const db = getDbClient();

  if (!db || schemaReady) {
    return db;
  }

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

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_speech_sessions_user_created
    ON speech_sessions (user_id, created_at DESC)
  `);

  schemaReady = true;
  return db;
}

export async function listRecentSpeechSessions(userId: string, limit = 6) {
  const db = await ensureSpeechSchema();

  if (!db) {
    return [];
  }

  const result = await db.execute({
    sql: `
      SELECT id, user_id, template_id, template_label, rubric_mode, transcript, feedback,
             overall_score, words_per_min, duration_seconds, created_at
      FROM speech_sessions
      WHERE user_id = ?
      ORDER BY datetime(created_at) DESC
      LIMIT ?
    `,
    args: [userId, limit],
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
    created_at: String(row.created_at),
  })) as SpeechSessionRecord[];
}

export async function insertSpeechSession(session: Omit<SpeechSessionRecord, 'created_at'>) {
  const db = await ensureSpeechSchema();

  if (!db) {
    return false;
  }

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

  return true;
}
