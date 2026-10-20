'use client';

import { useEffect, useRef, useState } from 'react';
import UploadZone from '@/components/UploadZone';
import ShootCard from '@/components/ShootCard';
import { runShoot } from '@/lib/pipeline';
import { Shoot } from '@/lib/types';

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
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10 md:px-10">
      <header className="mb-10 flex flex-wrap items-baseline justify-between gap-4 border-b border-thread/30 pb-6">
        <h1 className="font-display text-3xl italic text-canvas">Fitting Room</h1>
        <div className="flex items-baseline gap-6">
          <p className="text-sm text-thread">Upload a garment. Describe the shoot. Get the photo.</p>
          {username && <p className="text-sm text-canvas">{username}</p>}
          <button
            onClick={async () => {
              await fetch('/api/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
            className="text-sm text-thread underline underline-offset-4 hover:text-marigold"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="grid gap-10 md:grid-cols-[320px_1fr]">
        <div className="space-y-5 md:sticky md:top-10 md:self-start">
          <UploadZone value={garmentDataUrl} onChange={setGarmentDataUrl} />

          <div>
            <label htmlFor="prompt" className="mb-2 block text-sm text-thread">
              Describe the model and shoot
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A South Indian female model wearing this saree, studio lighting, plain grey backdrop"
              rows={4}
              className="w-full resize-none border border-thread/40 bg-transparent px-3 py-2 text-sm text-canvas placeholder:text-thread/50 focus:border-marigold focus:outline-none"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full bg-maroon py-3 text-sm text-canvas transition-colors hover:bg-marigold hover:text-ink disabled:cursor-not-allowed disabled:bg-thread/20 disabled:text-thread"
          >
            {isRunning ? 'Generating…' : 'Generate photo'}
          </button>

          <p className="text-xs leading-relaxed text-thread/70">
            Two stages: a model is generated from your description, then your garment is
            fitted onto them. Around 30–45 seconds and roughly $0.03 per photo.
          </p>
        </div>

        <div>
          {shoots.length === 0 ? (
            <div className="flex h-64 items-center justify-center border border-dashed border-thread/30 px-6 text-center text-sm text-thread/60">
              Your shoots will appear here.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {shoots.map((shoot) => (
                <ShootCard key={shoot.id} shoot={shoot} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
