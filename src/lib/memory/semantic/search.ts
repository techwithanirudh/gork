import { createLogger } from '@/lib/logger';
import { env } from '@/env';
import {
  Pinecone,
  type ScoredPineconeRecord,
} from '@pinecone-database/pinecone';
import { embed } from 'ai';
import { MD5 } from 'bun';
import { provider } from '@/lib/ai/providers';
import {
  PineconeMetadataSchema,
  flattenMetadata,
} from '@/lib/validators/pinecone';
import type { PineconeMetadataInput, PineconeMetadataOutput } from '@/types';

const logger = createLogger('memory:semantic:search');
const pinecone = new Pinecone({ apiKey: env.PINECONE_API_KEY });

let indexInitialized = false;

async function getIndex() {
  const name = env.PINECONE_INDEX;

  if (!indexInitialized) {
    const indexes = (await pinecone.listIndexes())?.indexes;
    if (!indexes || !indexes.some((i) => i.name === name)) {
      logger.warn(`Index ${name} does not exist, creating...`);
      await pinecone.createIndex({
        name,
        dimension: 1536,
        metric: 'dotproduct',
        waitUntilReady: true,
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });
    }
    indexInitialized = true;
  }

  return pinecone.Index(name);
}

export interface SearchOptions {
  namespace?: string;
  topK?: number;
  filter?: Record<string, unknown>;
}

export async function searchMemories(
  query: string,
  { namespace = 'default', topK = 5, filter }: SearchOptions = {},
): Promise<ScoredPineconeRecord<PineconeMetadataOutput>[]> {
  try {
    const { embedding } = await embed({
      model: provider.embeddingModel('small-model'),
      value: query,
    });

    const index = (await getIndex()).namespace(namespace);
    const result = await index.query({
      vector: embedding,
      topK,
      includeMetadata: true,
      filter,
    });

    const matches = result.matches || [];
    return matches.flatMap((match) => {
      const parsed = PineconeMetadataSchema.safeParse(match.metadata);
      if (!parsed.success) {
        logger.warn(
          { id: match.id, issues: parsed.error.issues },
          'Invalid metadata schema',
        );
        return [];
      }
      return { ...match, metadata: parsed.data };
    });
  } catch (error) {
    logger.error({ error }, 'Error searching memories');
    throw error;
  }
}

export async function addMemory(
  text: string,
  metadata: PineconeMetadataInput,
  namespace = 'default',
): Promise<string> {
  try {
    const basis = `${metadata.sessionId ?? 'global'}:${metadata.type}:${text}`;
    const id = new MD5().update(basis).digest('hex');

    const flattened = flattenMetadata(metadata);
    const parsed = PineconeMetadataSchema.safeParse({ ...flattened, hash: id });
    if (!parsed.success) {
      logger.warn({ id, issues: parsed.error.issues }, 'Invalid metadata');
      throw new Error('Invalid metadata schema');
    }

    const { embedding } = await embed({
      model: provider.embeddingModel('small-model'),
      value: text,
    });

    if (!embedding?.length) {
      throw new Error('Embedding is empty');
    }

    const index = (await getIndex()).namespace(namespace);
    await index.upsert({
      records: [{ id, values: embedding, metadata: parsed.data }],
    });

    logger.debug({ id, type: metadata.type }, 'Added memory');
    return id;
  } catch (error) {
    logger.error({ error }, 'Error adding memory');
    throw error;
  }
}

export async function deleteMemory(
  id: string,
  namespace = 'default',
): Promise<void> {
  try {
    const index = (await getIndex()).namespace(namespace);
    await index.deleteOne({ id });
    logger.debug({ id }, 'Deleted memory');
  } catch (error) {
    logger.error({ error }, 'Error deleting memory');
    throw error;
  }
}
