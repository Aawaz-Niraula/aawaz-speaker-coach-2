export async function fetchWithRetry(url: string, options: RequestInit, retries = 1, delayMs = 1000): Promise<Response> {
  let lastError: Error | unknown;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || res.status < 500) {
        return res;
      }
      
      // If it's a 5xx error, it might be transient, so we retry
      if (attempt === retries) {
        return res;
      }
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
    }
    
    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  
  throw lastError || new Error('Fetch failed after retries');
}
