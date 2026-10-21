'use client';

import { useEffect, useRef, useState } from 'react';
import UploadZone from '@/components/UploadZone';
import ShootCard from '@/components/ShootCard';
import { runShoot } from '@/lib/pipeline';
import { Shoot } from '@/lib/types';

const SUGGESTIONS = [
  'A South Indian female model wearing this garment, studio lighting, plain grey backdrop',
  'A male model wearing this, golden hour light, city street background',
  'Editorial shoot, soft window light, minimalist white room, confident pose'
];

export default function Home() {
  const [garmentDataUrl, setGarmentDataUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setUsername(d.username))
      .catch(() => {});
  }, []);

  // Ticks the elapsed-seconds counter on any in-flight shoot.
  const startedAtRef = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => {
      setShoots((prev) =>
        prev.map((s) => {
          if (s.stage !== 'model' && s.stage !== 'tryon') return s;
          const startedAt = startedAtRef.current[s.id];
          if (!startedAt) return s;
          return { ...s, elapsedSec: Math.round((Date.now() - startedAt) / 1000) };
        })
      );
    }, 1000);
    return () => clearInterval(t);
  }, [isRunning]);

  const canGenerate = Boolean(garmentDataUrl) && prompt.trim().length > 0 && !isRunning;

  async function handleGenerate() {
    if (!garmentDataUrl || !prompt.trim()) return;

    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    startedAtRef.current[id] = Date.now();

    setShoots((prev) => [
      {
        id,
        garmentDataUrl,
        prompt: prompt.trim(),
        stage: 'model',
        createdAt: Date.now(),
        elapsedSec: 0
      },
      ...prev
    ]);
    setIsRunning(true);

    try {
      const { modelImageUrl, resultImageUrl } = await runShoot(
        garmentDataUrl,
        prompt.trim(),
        (stage) => {
          setShoots((prev) =>
            prev.map((s) =>
              s.id === id
                ? { ...s, stage, ...(stage === 'tryon' ? {} : {}) }
                : s
            )
          );
        }
      );

      setShoots((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, stage: 'done', modelImageUrl, resultImageUrl } : s
        )
      );
    } catch (err: any) {
      setShoots((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, stage: 'error', errorMessage: err?.message ?? 'Something went wrong.' }
            : s
        )
      );
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 md:px-10 md:py-10">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl italic tracking-tight text-canvas md:text-5xl">
            Fitting <span className="text-marigold">Room</span>
          </h1>
          <p className="mt-1 text-sm text-thread">Upload a garment. Describe the shoot. Get the photo.</p>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-thread/20 bg-white/[0.03] py-1.5 pl-1.5 pr-4">
          {username && (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-maroon text-sm font-medium uppercase text-canvas">
              {username[0]}
            </span>
          )}
          {username && <span className="text-sm text-canvas">{username}</span>}
          <button
            onClick={async () => {
              await fetch('/api/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
            className="text-sm text-thread transition-colors hover:text-marigold"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="grid gap-8 md:grid-cols-[340px_1fr] md:gap-10">
        <section className="space-y-6 rounded-2xl border border-thread/20 bg-white/[0.03] p-5 shadow-xl shadow-black/30 md:sticky md:top-8 md:self-start">
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm text-thread">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-maroon text-xs text-canvas">1</span>
              Garment
            </h2>
            <UploadZone value={garmentDataUrl} onChange={setGarmentDataUrl} />
          </div>

          <div>
            <label htmlFor="prompt" className="mb-3 flex items-center gap-2 text-sm text-thread">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-maroon text-xs text-canvas">2</span>
              Describe the model and shoot
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A South Indian female model wearing this saree, studio lighting, plain grey backdrop"
              rows={4}
              className="w-full resize-none rounded-lg border border-thread/30 bg-black/20 px-3 py-2 text-sm text-canvas placeholder:text-thread/50 focus:border-marigold focus:outline-none focus:ring-1 focus:ring-marigold/40"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPrompt(s)}
                  className="rounded-full border border-thread/25 px-3 py-1 text-left text-xs text-thread transition-colors hover:border-marigold/60 hover:text-marigold"
                >
                  {s.split(',').slice(0, 2).join(',')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full rounded-lg bg-gradient-to-r from-maroon to-[#8a2a38] py-3 text-sm font-medium tracking-wide text-canvas shadow-lg shadow-maroon/40 transition-all hover:-translate-y-0.5 hover:from-marigold hover:to-[#e8b04a] hover:text-ink disabled:translate-y-0 disabled:cursor-not-allowed disabled:from-thread/15 disabled:to-thread/15 disabled:text-thread disabled:shadow-none"
            >
              {isRunning ? 'Generating…' : 'Generate photo'}
            </button>
            <p className="mt-3 text-xs leading-relaxed text-thread/70">
              Two stages: a model is generated from your description, then your garment is
              fitted onto them. Around 40–60 seconds and roughly $0.08–0.10 per photo.
            </p>
          </div>
        </section>

        <section>
          {shoots.length > 0 && (
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-sm text-thread">Your shoots</h2>
              <span className="text-xs text-thread/60">
                {shoots.length} {shoots.length === 1 ? 'photo' : 'photos'}
              </span>
            </div>
          )}
          {shoots.length === 0 ? (
            <div className="flex h-80 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-marigold/25 bg-gradient-to-b from-white/[0.02] to-transparent px-6 text-center">
              <p className="font-display text-2xl italic text-canvas/80">The studio is empty</p>
              <p className="text-sm text-thread/60">
                Add a garment and a description, then your shoots will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {shoots.map((shoot) => (
                <ShootCard key={shoot.id} shoot={shoot} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
