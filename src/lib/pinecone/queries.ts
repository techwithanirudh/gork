import { createLogger } from '@/lib/logger';

import { PineconeMetadataSchema } from '@/lib/validators/pinecone';
import type { PineconeMetadataInput, PineconeMetadataOutput } from '@/types';
import { type ScoredPineconeRecord } from '@pinecone-database/pinecone';
import { embed } from 'ai';
import { MD5 } from 'bun';
import { myProvider } from '../ai/providers';
import { getIndex } from './index';

const logger = createLogger('pinecone:queries');

export interface MemorySearchOptions {
  namespace?: string;
  topK?: number;
  filter?: Record<string, unknown>;
}

export const searchMemories = async (
  query: string,
  { namespace = 'default', topK = 5, filter }: MemorySearchOptions = {}
): Promise<ScoredPineconeRecord<PineconeMetadataOutput>[]> => {
  try {
    const { embedding } = await embed({
      model: myProvider.textEmbeddingModel('small-model'),
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
          'Invalid metadata schema'
        );
        return [];
      }

      return {
        ...match,
        metadata: parsed.data,
      };
    });
  } catch (error) {
    logger.error({ error }, 'Error searching memories');
    throw error;
  }
};

export const addMemory = async (
  text: string,
  metadata: Omit<PineconeMetadataInput, 'hash'>,
  namespace = 'default'
): Promise<string> => {
  try {
    const id = new MD5().update(text).digest('hex');

    const parsed = PineconeMetadataSchema.safeParse({
      ...metadata,
      hash: id,
    });
    if (!parsed.success) {
      logger.warn(
        { id, issues: parsed.error.issues },
        'Invalid metadata provided, skipping add'
      );
      throw new Error('Invalid metadata schema');
    }

    const { embedding } = await embed({
      model: myProvider.textEmbeddingModel('small-model'),
      value: text,
    });

    const index = (await getIndex()).namespace(namespace);
    await index.upsert([
      {
        id,
        values: embedding,
        metadata: parsed.data,
      },
    ]);

    logger.debug({ id, metadata }, 'Added memory');
    return id;
  } catch (error) {
    logger.error({ error }, 'Error adding memory');
    throw error;
  }
};

export const deleteMemory = async (
  id: string,
  namespace = 'default'
): Promise<void> => {
  try {
    const index = (await getIndex()).namespace(namespace);
    await index.deleteOne(id);
    logger.debug({ id }, 'Deleted memory');
  } catch (error) {
    logger.error({ error }, 'Error deleting memory');
    throw error;
  }
};
