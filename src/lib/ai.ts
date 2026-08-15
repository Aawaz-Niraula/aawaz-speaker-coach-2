/**
 * The models that mark speeches, shared by /transcribe-analyze and
 * /deep-analysis.
 *
 * Both routes score the same speech, so they must run the same model: if one
 * were changed and the other left behind, the standard and deeper scores would
 * drift apart and the app would contradict itself on the same recording.
 *
 * gemma-4-26B was kept here over DeepSeek-V4-Flash and Kimi-K3 on measured
 * behaviour, marking one strong and one weak speech three times each:
 *
 *   gemma-4-26B   91/91/91 and 32/31/31   60-point separation, arithmetic 6/6
 *   V4-Flash      84/88/82 and 48/52/52   34-point separation, arithmetic 5/6
 *   Kimi-K3       unusable: a reasoning model, 45s+ per call and truncating
 *
 * Consistency is what matters most for a score a user sees. gemma returns the
 * same mark for the same speech, where V4-Flash swung 6 points across repeats
 * and passed a speech with no argument or structure at 50/100. V4-Flash is
 * faster at 2.7s against 7.3s, which does not buy back either failure.
 */
export const ANALYSIS_MODELS = [
  'google/gemma-4-26B-A4B-it',
  'Qwen/Qwen3-14B',
] as const;

/**
 * Turbo first: about 8x faster than whisper-large-v3 at near-identical
 * accuracy. The full model stays as a fallback if turbo is unavailable.
 */
export const TRANSCRIPTION_MODELS = [
  'openai/whisper-large-v3-turbo',
  'openai/whisper-large-v3',
] as const;

export type ChatCompletionData = {
  error?: {
    message?: string;
  };
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export function getProviderErrorMessage(data: ChatCompletionData) {
  return typeof data.error?.message === 'string' ? data.error.message : undefined;
}

export function isProviderUnavailable(status: number, message?: string) {
  const normalized = message?.toLowerCase() ?? '';

  return (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    normalized.includes('busy') ||
    normalized.includes('overloaded') ||
    normalized.includes('temporarily unavailable') ||
    normalized.includes('capacity') ||
    normalized.includes('not available') ||
    normalized.includes('unavailable')
  );
}

export function isAbortTimeout(error: unknown) {
  return error instanceof DOMException && error.name === 'TimeoutError';
}
