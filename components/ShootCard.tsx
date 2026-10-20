'use client';

import { Shoot } from '@/lib/types';

const stageLabel: Record<Shoot['stage'], string> = {
  model: 'Casting the model',
  tryon: 'Fitting the garment',
  done: 'Ready',
  error: 'Failed'
};

export default function ShootCard({ shoot }: { shoot: Shoot }) {
  const isWorking = shoot.stage === 'model' || shoot.stage === 'tryon';

  return (
    <div className="border border-thread/30">
      <div className="flex items-center justify-between border-b border-thread/30 px-4 py-2 text-xs text-thread">
        <span>{new Date(shoot.createdAt).toLocaleTimeString()}</span>
        <span
          className={
            shoot.stage === 'error' ? 'text-maroon' : shoot.stage === 'done' ? 'text-marigold' : ''
          }
        >
          {stageLabel[shoot.stage]}
          {isWorking && shoot.elapsedSec !== undefined ? ` · ${shoot.elapsedSec}s` : ''}
        </span>
      </div>

      <div className="relative aspect-[3/4] w-full bg-black/20">
        {shoot.resultImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shoot.resultImageUrl} alt={shoot.prompt} className="h-full w-full object-cover" />
        ) : shoot.stage === 'error' ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm leading-relaxed text-maroon">
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
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin border-2 border-marigold border-t-transparent" />
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
            className="inline-block text-sm text-marigold underline underline-offset-4 hover:text-canvas"
          >
            Open full size
          </a>
        )}
      </div>
    </div>
  );
}
