import Replicate from 'replicate';

let client: Replicate | null = null;

export function getReplicateClient(): Replicate {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error(
      'REPLICATE_API_TOKEN is not set. Add it in your Vercel project settings (or .env.local for local dev).'
    );
  }
  if (!client) {
    client = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  }
  return client;
}

// Text-to-image: generates the base model photo from a text description.
// This is an "official" Replicate model, so predictions.create({ model })
// works directly and always runs its latest version.
export const MODEL_GEN_MODEL = 'black-forest-labs/flux-schnell';

// Virtual try-on: dresses the generated model in the uploaded garment.
// NOTE: cuuupid/idm-vton is CC BY-NC-SA 4.0 (non-commercial). Swap this for a
// commercially licensed try-on model before running this as a paid product.
//
// This is a COMMUNITY model, not an official one — Replicate's
// "run by owner/name" shortcut (predictions.create({ model })) 404s on
// community models. They require a specific version id instead, passed to
// predictions.create({ version, input }). getTryonVersionId() below fetches
// that model's current latest version id at request time so this doesn't
// silently break if the model owner ships a new version.
const TRYON_OWNER = 'cuuupid';
const TRYON_NAME = 'idm-vton';

export async function getTryonVersionId(replicate: Replicate): Promise<string> {
  const model = await replicate.models.get(TRYON_OWNER, TRYON_NAME);
  const versionId = model.latest_version?.id;
  if (!versionId) {
    throw new Error(`Could not resolve a version id for ${TRYON_OWNER}/${TRYON_NAME}.`);
  }
  return versionId;
}
