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
