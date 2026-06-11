/**
 * DeepInfra cloned-voice housekeeping.
 *
 * Voice slots on the provider account are limited, so every voice we create
 * must eventually be deleted — otherwise replacing a sample a few times fills
 * the account with orphans and `/v1/voices/add` starts failing with opaque
 * internal server errors.
 */

const VOICES_URL = 'https://api.deepinfra.com/v1/voices';

/** The exact name we register voices under, per user. */
export function providerVoiceName(userId: string) {
  return `Aawaz voice ${userId.slice(0, 18) || 'anon'}`;
}

function isUserProviderVoiceName(name: unknown, userId: string) {
  if (typeof name !== 'string') return false;
  const targetName = providerVoiceName(userId);
  return name === targetName || name.startsWith(`${targetName} `);
}

/** Best-effort delete of a single provider voice. Never throws. */
export async function deleteProviderVoice(voiceId: string, token: string) {
  if (!voiceId) return;

  try {
    await fetch(`${VOICES_URL}/${encodeURIComponent(voiceId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    // Best effort — an orphaned voice is not fatal, just wasteful.
  }
}

type ProviderVoice = { voice_id?: unknown; name?: unknown };

async function listProviderVoices(token: string) {
  const res = await fetch(VOICES_URL, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];

  const data: unknown = await res.json().catch(() => null);
  return Array.isArray(data)
    ? data as ProviderVoice[]
    : data && typeof data === 'object'
      ? ((data as Record<string, unknown>).voices as ProviderVoice[] | undefined)
        ?? ((data as Record<string, unknown>).results as ProviderVoice[] | undefined)
        ?? []
      : [];
}

export async function findNewestUserProviderVoiceId(userId: string, token: string) {
  try {
    const voices = await listProviderVoices(token);
    const matches = voices
      .filter((voice) => typeof voice?.voice_id === 'string' && isUserProviderVoiceName(voice?.name, userId))
      .map((voice) => ({
        voiceId: voice.voice_id as string,
        createdAt: Number((voice as Record<string, unknown>).created_at ?? 0),
        updatedAt: Number((voice as Record<string, unknown>).updated_at ?? 0),
      }))
      .sort((a, b) => Math.max(b.createdAt, b.updatedAt) - Math.max(a.createdAt, a.updatedAt));

    return matches[0]?.voiceId ?? '';
  } catch {
    return '';
  }
}

export async function findNewestProviderVoiceIdByName(name: string, token: string) {
  try {
    const voices = await listProviderVoices(token);
    const matches = voices
      .filter((voice) => typeof voice?.voice_id === 'string' && voice?.name === name)
      .map((voice) => ({
        voiceId: voice.voice_id as string,
        createdAt: Number((voice as Record<string, unknown>).created_at ?? 0),
        updatedAt: Number((voice as Record<string, unknown>).updated_at ?? 0),
      }))
      .sort((a, b) => Math.max(b.createdAt, b.updatedAt) - Math.max(a.createdAt, a.updatedAt));

    return matches[0]?.voiceId ?? '';
  } catch {
    return '';
  }
}

/**
 * Deletes every provider voice registered under this user's name
 * (except `keepVoiceId`). Used to reclaim slots from older replaced samples.
 * Never throws.
 */
export async function deleteUserProviderVoices(userId: string, token: string, keepVoiceId?: string) {
  try {
    const staleIds = (await listProviderVoices(token))
      .filter((voice) => typeof voice?.voice_id === 'string' && voice.voice_id !== keepVoiceId && isUserProviderVoiceName(voice?.name, userId))
      .map((voice) => voice.voice_id as string);

    await Promise.all(staleIds.map((id) => deleteProviderVoice(id, token)));
  } catch {
    // Best effort.
  }
}
