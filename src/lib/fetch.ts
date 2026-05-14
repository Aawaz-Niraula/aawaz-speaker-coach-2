export async function fetchWithRetry(url: string, options: RequestInit, retries = 1, delayMs = 1000, timeoutMs?: number): Promise<Response> {
  let lastError: Error | unknown;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const currentOptions = { ...options };
      if (timeoutMs) {
        currentOptions.signal = AbortSignal.timeout(timeoutMs);
      }
      
      const res = await fetch(url, currentOptions);
      // Wait and retry if we hit server errors or model overload/rate-limiting (429)
      if (res.ok || (res.status < 500 && res.status !== 429)) {
        return res;
      }
      
      // If it's a 5xx error or 429, it is transient, so we retry
      if (attempt === retries) {
        return res;
      }
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
    }
    
    // Wait before retrying with exponential backoff and jitter to prevent thundering herd during heavy traffic
    const jitter = Math.random() * 300;
    const currentDelay = delayMs * Math.pow(1.5, attempt) + jitter;
    await new Promise((resolve) => setTimeout(resolve, currentDelay));
  }
  
  throw lastError || new Error('Fetch failed after retries');
}
