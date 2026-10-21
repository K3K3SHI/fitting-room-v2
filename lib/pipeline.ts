import { PredictionResponse } from './types';

const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 5 * 60 * 1000;
// A single failed poll must NOT kill the job. Dev-server recompiles, cold
// starts, brief network blips and gateway hiccups all produce transient
// non-200s while the prediction itself is running perfectly fine on
// Replicate. We only give up after this many CONSECUTIVE failures.
const MAX_CONSECUTIVE_ERRORS = 8;

export class PipelineError extends Error {}

// Replicate throttles accounts under $5 credit (6 requests/min, burst of 1).
// On a 429 we wait the time it asks for and try again instead of failing.
const MAX_RATE_LIMIT_RETRIES = 6;

async function createPrediction(payload: Record<string, unknown>): Promise<{ id: string }> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const raw = await res.text();
    let data: any = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new PipelineError(`Server returned an unreadable response (HTTP ${res.status}).`);
    }

    if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const waitSec = Math.min(Number(data.retryAfter) || 8, 30);
      await sleep((waitSec + 1) * 1000);
      continue;
    }

    if (!res.ok || !data.id) {
      throw new PipelineError(data.error || `Could not start generation (HTTP ${res.status}).`);
    }
    return data;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Polls one prediction until it reaches a terminal state.
 * Transient failures are retried rather than treated as fatal.
 */
async function pollPrediction(
  id: string,
  onProgress?: (info: { elapsedMs: number; transientErrors: number }) => void
): Promise<PredictionResponse> {
  const started = Date.now();
  let consecutiveErrors = 0;
  let totalTransientErrors = 0;

  while (Date.now() - started < TIMEOUT_MS) {
    try {
      const res = await fetch(`/api/predict/${id}`, { cache: 'no-store' });
      const raw = await res.text();

      let data: any;
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(`Unreadable response (HTTP ${res.status})`);
      }

      if (!res.ok) {
        // 4xx that clearly means "this id is wrong" is permanent - fail fast.
        if (res.status === 404) {
          throw new PipelineError(data.error || 'Prediction not found.');
        }
        // Everything else (5xx, 502, 503, rate limits) is treated as transient.
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      // Successful poll - reset the failure streak.
      consecutiveErrors = 0;

      if (data.status === 'succeeded') return data as PredictionResponse;
      if (data.status === 'failed' || data.status === 'canceled') {
        throw new PipelineError(data.error || `Generation ${data.status}.`);
      }
    } catch (err) {
      // A PipelineError is a real, permanent failure - propagate immediately.
      if (err instanceof PipelineError) throw err;

      consecutiveErrors += 1;
      totalTransientErrors += 1;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        throw new PipelineError(
          `Lost contact with the server after ${consecutiveErrors} attempts. ` +
            `The job may still be running - check your Replicate dashboard.`
        );
      }
      // fall through to the wait below and try again
    }

    onProgress?.({ elapsedMs: Date.now() - started, transientErrors: totalTransientErrors });
    await sleep(POLL_INTERVAL_MS);
  }

  throw new PipelineError(
    'Timed out after 5 minutes. The job may still be running - check your Replicate dashboard.'
  );
}

/** Replicate returns either a bare URL string or an array of them. */
function firstUrl(output: string | string[] | null): string {
  if (!output) throw new PipelineError('The model finished but returned no image.');
  const url = Array.isArray(output) ? output[0] : output;
  if (typeof url !== 'string' || !url.startsWith('http')) {
    throw new PipelineError('The model returned an unexpected output format.');
  }
  return url;
}

export async function runShoot(
  garmentDataUrl: string,
  prompt: string,
  onStage: (stage: 'model' | 'tryon') => void
): Promise<{ modelImageUrl: string; resultImageUrl: string }> {
  // Stage 1 - generate a photorealistic model from the text description.
  onStage('model');
  const modelJob = await createPrediction({ stage: 'model', prompt });
  const modelResult = await pollPrediction(modelJob.id);
  const modelImageUrl = firstUrl(modelResult.output);

  // Stage 2 - dress that model in the uploaded garment.
  onStage('tryon');
  const tryonJob = await createPrediction({
    stage: 'tryon',
    garmentDataUrl,
    modelImageUrl,
    prompt
  });
  const tryonResult = await pollPrediction(tryonJob.id);
  const resultImageUrl = firstUrl(tryonResult.output);

  return { modelImageUrl, resultImageUrl };
}