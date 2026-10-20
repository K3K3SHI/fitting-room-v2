import { NextRequest, NextResponse } from 'next/server';
import { getReplicateClient, MODEL_GEN_MODEL, getTryonVersionId } from '@/lib/replicate';
import { isAuthenticated } from '@/lib/auth';

// Kicks off ONE prediction and returns immediately with its id.
// The client polls GET /api/predict/[id] for the result. This two-step
// (create, then poll) shape keeps each request short so it never hits a
// serverless function's execution-time limit, even though the underlying
// AI job can take 15-30+ seconds.
export async function POST(req: NextRequest) {
  // Defense-in-depth: this endpoint spends real money per call, so it
  // checks the session itself rather than trusting proxy.ts alone.
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
  }

  let body: {
    stage: 'model' | 'tryon';
    prompt?: string;
    garmentDataUrl?: string;
    modelImageUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
  }

  try {
    const { stage, prompt, garmentDataUrl, modelImageUrl } = body;
    const replicate = getReplicateClient();

    if (stage === 'model') {
      if (!prompt) {
        return NextResponse.json({ error: 'Missing prompt.' }, { status: 400 });
      }
      const prediction = await replicate.predictions.create({
        model: MODEL_GEN_MODEL,
        input: {
          prompt: `${prompt}, full body shot, studio photography, hyperrealistic, fashion editorial, sharp focus, professional lighting`,
          aspect_ratio: '3:4',
          output_format: 'png'
        }
      });
      return NextResponse.json({ id: prediction.id, status: prediction.status });
    }

    if (stage === 'tryon') {
      if (!garmentDataUrl || !modelImageUrl) {
        return NextResponse.json({ error: 'Missing garment or model image.' }, { status: 400 });
      }
      const version = await getTryonVersionId(replicate);
      const prediction = await replicate.predictions.create({
        version,
        input: {
          human_img: modelImageUrl,
          garm_img: garmentDataUrl,
          garment_des: prompt || 'garment'
        }
      });
      return NextResponse.json({ id: prediction.id, status: prediction.status });
    }

    return NextResponse.json({ error: 'Unknown stage.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Generation failed.' }, { status: 500 });
  }
}
