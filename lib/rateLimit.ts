/**
 * Tiny in-memory limiter for login / register attempts. Per-process only
 * (resets on restart, not shared across serverless instances) — enough to
 * slow down password guessing in a demo; use Redis/Upstash for real scale.
 */
const hits = new Map<string, number[]>();

export function tooManyAttempts(key: string, max = 8, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}

export function clearAttempts(key: string) {
  hits.delete(key);
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
}
