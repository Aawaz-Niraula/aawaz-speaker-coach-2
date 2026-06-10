'use client';

export async function requestJson<T>(url: string, init?: RequestInit, timeoutMs = 300000): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.error) {
      const errorMsg = typeof data.error === 'string' ? data.error : (typeof data.feedback === 'string' ? data.feedback : 'Request failed.');
      const error = new Error(errorMsg);
      if (data.authRequired) {
        error.name = 'AuthRequiredError';
      } else if (data.identityRequired) {
        error.name = 'IdentityRequiredError';
      }
      throw error;
    }

    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The request took too long. Please try again.');
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
