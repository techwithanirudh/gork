import logger from '@/lib/logger';
import type { PineconeMetadata } from '@/types';
import { type ScoredPineconeRecord } from '@pinecone-database/pinecone';
import { embed } from 'ai';
import { MD5 } from 'bun';
import { myProvider } from '../ai/providers';
import { getIndex } from './index';

const log = logger.child({ tool: 'queryMemories' });

export interface MemorySearchOptions {
  namespace?: string;
  topK?: number;
  filter?: Record<string, any>;
}

export interface QueryMemoriesOptions {
  limit?: number;
  ageLimit?: number; 
  ignoreRecent?: boolean;
  onlyTools?: boolean;
}

export const queryMemories = async (
  query: string,
  options: QueryMemoriesOptions = {}
): Promise<ScoredPineconeRecord<PineconeMetadata>[]> => {
  const {
    limit = 4,
    ageLimit,
    ignoreRecent = true,
    onlyTools = false
  } = options;

  const filter: Record<string, any> = {};

  const now = Date.now();
  if (ignoreRecent) {
    const recentTime = now - 60000;
    filter.creation_time = { $lt: recentTime };
  }
  if (ageLimit != null) {
    filter.creation_time = {
      ...filter.creation_time,
      $gt: now - ageLimit
    };
  }

  if (onlyTools) {
    filter.type = { $eq: 'tool' };
  }

  try {
    const results = await searchMemories(query, {
      topK: limit,
      filter: Object.keys(filter).length > 0 ? filter : undefined
    });

    log.debug({
      query,
      limit,
      ageLimit,
      ignoreRecent,
      onlyTools,
      resultIds: results.map(doc => doc.id.slice(0, 16) + '...')
    }, 'Long term memory query completed');

    const index = await getIndex();
    await Promise.all(
      results.map(result =>
        index.update({
          id: result.id,
          metadata: { last_retrieval_time: now }
        })
      )
    );

    return results;
  } catch (error) {
    log.error({ error, query }, 'Error querying long term memory');
    return [];
  }
};

export const searchMemories = async (
  query: string,
  options: MemorySearchOptions = {}
): Promise<ScoredPineconeRecord<PineconeMetadata>[]> => {
  const { namespace = 'default', topK = 4, filter } = options;

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
    const { embedding } = await embed({
      model: myProvider.textEmbeddingModel('small-model'),
      value: text,
    });

    const idx = await getIndex();
    const index = idx.namespace(namespace);

    const vector = {
      id: hash,
      values: embedding,
      metadata,
    };

    await index.upsert([vector]);
    logger.info({ id: hash }, 'Added memory');
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
    logger.info({ id: hash }, 'Deleted memory');
  } catch (error) {
    logger.error({ error }, 'Error deleting memory');
    throw error;
  }
};
