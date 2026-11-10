import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = 'gemini-flash-latest';

// Gemini overload spikes (503) usually last tens of seconds: wait long enough
// between attempts for the retry to have a real chance of succeeding.
export const RETRY_DELAYS_MS = [15_000, 30_000];
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

const RETRYABLE_STATUSES = new Set([429, 500, 503, 504]);
const RETRYABLE_NETWORK_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_SOCKET']);

export function isRetryableError(err) {
  if (RETRYABLE_STATUSES.has(err?.status)) return true;
  const code = err?.code ?? err?.cause?.code;
  return RETRYABLE_NETWORK_CODES.has(code) || err?.message === 'fetch failed';
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run a Gemini call, retrying transient failures.
 * onRetry({ attempt, maxAttempts, delayMs, error }) is awaited before each wait;
 * `attempt` is the number of the upcoming attempt (2, 3, ...).
 */
async function withRetry(fn, onRetry) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || !isRetryableError(err)) {
        err.attempts = attempt;
        throw err;
      }
      const delayMs = RETRY_DELAYS_MS[attempt - 1];
      console.warn(
        `Gemini call failed (attempt ${attempt}/${MAX_ATTEMPTS}, status ${err?.status ?? err?.code}), retrying in ${delayMs / 1000}s`,
      );
      await onRetry?.({ attempt: attempt + 1, maxAttempts: MAX_ATTEMPTS, delayMs, error: err });
      await sleep(delayMs);
    }
  }
}

const SUMMARY_INSTRUCTIONS =
  'Summarize this content in English, as concise and structured key points. ' +
  'Get straight to the point, no introductory fluff.';

export async function summarizeYoutubeUrl(url, { onRetry } = {}) {
  const response = await withRetry(() => ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: SUMMARY_INSTRUCTIONS },
          { fileData: { fileUri: url, mimeType: 'video/mp4' } },
        ],
      },
    ],
  }), onRetry);

  return response.text;
}

export async function summarizeText(title, text, { onRetry } = {}) {
  const truncated = text.slice(0, 100_000);

  const response = await withRetry(() => ai.models.generateContent({
    model: MODEL,
    contents: `${SUMMARY_INSTRUCTIONS}\n\nTitle: ${title}\n\nContent:\n${truncated}`,
  }), onRetry);

  return response.text;
}
