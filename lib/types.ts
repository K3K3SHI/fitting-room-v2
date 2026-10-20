export type PredictionStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';

export interface PredictionResponse {
  id: string;
  status: PredictionStatus;
  output: string | string[] | null;
  error: string | null;
}

export interface Shoot {
  id: string;
  garmentDataUrl: string;
  prompt: string;
  stage: 'model' | 'tryon' | 'done' | 'error';
  modelImageUrl?: string;
  resultImageUrl?: string;
  errorMessage?: string;
  createdAt: number;
  elapsedSec?: number;
}
