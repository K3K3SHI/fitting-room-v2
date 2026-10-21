'use client';

import { Shoot } from '@/lib/types';

const stageLabel: Record<Shoot['stage'], string> = {
  model: 'Casting the model',
  tryon: 'Fitting the garment',
  done: 'Ready',
  error: 'Failed'
};

// Two-step progress: 1 = model, 2 = try-on. Done fills both.
function Stepper({ stage }: { stage: Shoot['stage'] }) {
  const active = stage === 'model' ? 1 : stage === 'tryon' ? 2 : 3;
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {[1, 2].map((n) => (
        <span
          key={n}
          className={`h-1 w-6 rounded-full transition-colors ${
            n < active ? 'bg-marigold' : n === active ? 'animate-pulse bg-marigold/70' : 'bg-thread/20'
          }`}
        />
      ))}
    </div>
  );
}

export default function ShootCard({ shoot }: { shoot: Shoot }) {
  const isWorking = shoot.stage === 'model' || shoot.stage === 'tryon';

  return (
    <div className="group animate-fade-up overflow-hidden rounded-xl border border-thread/20 bg-white/[0.03] shadow-lg shadow-black/30 transition-all duration-300 hover:-translate-y-1 hover:border-marigold/40 hover:shadow-2xl hover:shadow-black/50">
      <div className="flex items-center justify-between px-4 py-2.5 text-xs text-thread">
        <span>{new Date(shoot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span className="flex items-center gap-2">
          {isWorking && <Stepper stage={shoot.stage} />}
          <span
            className={
              shoot.stage === 'error'
                ? 'text-red-400'
                : shoot.stage === 'done'
                  ? 'text-marigold'
                  : ''
            }
          >
            {stageLabel[shoot.stage]}
            {isWorking && shoot.elapsedSec !== undefined ? ` · ${shoot.elapsedSec}s` : ''}
          </span>
        </span>
      </div>

      <div className="relative aspect-[3/4] w-full overflow-hidden bg-black/30">
        {shoot.resultImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shoot.resultImageUrl}
              alt={shoot.prompt}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            {/* The garment you uploaded, for quick before/after comparison. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shoot.garmentDataUrl}
              alt="Original garment"
              className="absolute bottom-3 left-3 h-16 w-12 rounded-md border-2 border-canvas/80 object-cover shadow-lg"
            />
          </>
        ) : shoot.stage === 'error' ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm leading-relaxed text-red-300">
            {shoot.errorMessage}
          </div>
        ) : (
          <>
            {/* Once stage 1 finishes, show the generated model while the
                garment is being fitted — progress you can actually see. */}
            {shoot.modelImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shoot.modelImageUrl}
                alt="Generated model"
                className="h-full w-full object-cover opacity-40"
              />
            )}
            {/* Shimmer sweep so a waiting card never looks frozen. */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="h-full w-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-marigold border-t-transparent" />
            </div>
          </>
        )}
      </div>

      <div className="space-y-2 px-4 py-3">
        <p className="line-clamp-2 text-sm text-canvas/80">{shoot.prompt}</p>
        {shoot.resultImageUrl && (
          <a
            href={shoot.resultImageUrl}
            download
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-marigold underline-offset-4 hover:text-canvas hover:underline"
          >
            Open full size <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
    </div>
  );
}
