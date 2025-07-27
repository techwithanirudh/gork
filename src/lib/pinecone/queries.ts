import logger from '@/lib/logger';
import type { PineconeMetadata } from '@/types';
import { type ScoredPineconeRecord } from '@pinecone-database/pinecone';
import { embed } from 'ai';
import { MD5 } from 'bun';
import { myProvider } from '../ai/providers';
import { getIndex } from './index';

export interface MemorySearchOptions {
  namespace?: string;
  topK?: number;
  filter?: Record<string, any>;
}

export const searchMemories = async (
  query: string,
  options: MemorySearchOptions = {}
): Promise<ScoredPineconeRecord<PineconeMetadata>[]> => {
  const { namespace = 'default', topK = 5, filter } = options;

  try {
    const { embedding } = await embed({
      model: myProvider.textEmbeddingModel('small-model'),
      value: query,
    });

    const idx = await getIndex();
    const index = idx.namespace(namespace);
    const queryResult = await index.query({
      vector: embedding,
      topK,
      includeMetadata: true,
      filter,
    });

    const matches = queryResult.matches || [];
    return matches.map((match) => ({
      ...match,
      metadata: match.metadata as PineconeMetadata,
    }));
  } catch (error) {
    logger.error({ error }, 'Error searching memories');
    throw error;
  }
};

export const addMemory = async (
  text: string,
  metadata: Omit<PineconeMetadata, 'text' | 'hash'>,
  namespace = 'default'
): Promise<string> => {
  try {
    const hash = new MD5().update(text).digest('hex');
    const fullMetadata: PineconeMetadata = { text, hash, ...metadata };
    const { embedding } = await embed({
      model: myProvider.textEmbeddingModel('small-model'),
      value: text,
    });

    const idx = await getIndex();
    const index = idx.namespace(namespace);

    const vector = {
      id: hash,
      values: embedding,
      metadata: fullMetadata,
    };

    await index.upsert([vector]);
    logger.info({ hash }, 'Added memory');
    return hash;
  } catch (error) {
    logger.error({ error }, 'Error adding memory');
    throw error;
  }
};

export const deleteMemory = async (
  hash: string,
  namespace = 'default'
): Promise<void> => {
  try {
    const idx = await getIndex();
    const index = idx.namespace(namespace);
    await index.deleteOne(hash);
    logger.info({ hash }, 'Deleted memory');
  } catch (error) {
    logger.error({ error }, 'Error deleting memory');
    throw error;
  }
};
