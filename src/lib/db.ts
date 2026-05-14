import { createClient } from '@libsql/client';

type DbClient = ReturnType<typeof createClient>;

const MAX_SESSIONS_PER_USER = 50;

let dbClient: DbClient | null | undefined;
let schemaReady = false;
let schemaReadyPromise: Promise<DbClient | null> | null = null;

function bytesFromBase64(value: string) {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch {
    return new ArrayBuffer(0);
  }
}

function normalizeBlobValue(value: unknown) {
  if (value instanceof ArrayBuffer) {
    return value;
  }

  if (value instanceof Uint8Array) {
    const copy = new Uint8Array(value.byteLength);
    copy.set(value);
    return copy.buffer;
  }

  if (typeof value === 'string') {
    return bytesFromBase64(value);
  }

  return new ArrayBuffer(0);
}

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
  created_at: string;
};

export type SpeechVoiceSampleRecord = {
  user_id: string;
  audio_data: ArrayBuffer;
  mime_type: string;
  filename: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
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

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_speech_sessions_user_created
      ON speech_sessions (user_id, created_at DESC)
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS speech_voice_samples (
        user_id TEXT PRIMARY KEY,
        audio_data BLOB NOT NULL,
        mime_type TEXT NOT NULL,
        filename TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
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

export async function upsertSpeechVoiceSample({
  userId,
  audioData,
  mimeType,
  filename,
}: {
  userId: string;
  audioData: ArrayBuffer;
  mimeType: string;
  filename: string;
}) {
  const db = await ensureSpeechSchema();

  if (!db) {
    return false;
  }

  try {
    await db.execute({
      sql: `
        INSERT INTO speech_voice_samples (
          user_id, audio_data, mime_type, filename, size_bytes
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          audio_data = excluded.audio_data,
          mime_type = excluded.mime_type,
          filename = excluded.filename,
          size_bytes = excluded.size_bytes,
          updated_at = CURRENT_TIMESTAMP
      `,
      args: [userId, audioData, mimeType, filename, audioData.byteLength],
    });

    return true;
  } catch (error) {
    console.error('Failed to upsert speech voice sample:', error);
    return false;
  }
}

export async function getSpeechVoiceSample(userId: string) {
  const db = await ensureSpeechSchema();

  if (!db) {
    return null;
  }

  try {
    const result = await db.execute({
      sql: `
        SELECT user_id, audio_data, mime_type, filename, size_bytes, created_at, updated_at
        FROM speech_voice_samples
        WHERE user_id = ?
        LIMIT 1
      `,
      args: [userId],
    });

    const row = result.rows[0];
    if (!row) return null;

    const audioData = normalizeBlobValue(row.audio_data);

    return {
      user_id: String(row.user_id),
      audio_data: audioData,
      mime_type: String(row.mime_type),
      filename: String(row.filename),
      size_bytes: Number(row.size_bytes),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    } as SpeechVoiceSampleRecord;
  } catch (error) {
    console.error('Failed to get speech voice sample:', error);
    return null;
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
               overall_score, words_per_min, duration_seconds, created_at
        FROM speech_sessions
        WHERE user_id = ?
        ORDER BY datetime(created_at) DESC
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
      created_at: String(row.created_at),
    })) as SpeechSessionRecord[];
  } catch (error) {
    console.error('Failed to list speech sessions:', error);
    return [];
  }
}

export async function insertSpeechSession(session: Omit<SpeechSessionRecord, 'created_at'>) {
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
            ORDER BY datetime(created_at) DESC
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
