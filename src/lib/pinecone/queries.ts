import logger from '@/lib/logger';
import { PineconeMetadataSchema } from '@/lib/validators/pinecone';
import type { PineconeMetadataInput, PineconeMetadataOutput } from '@/types';
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
  {
    limit = 4,
    ageLimit,
    ignoreRecent = true,
    onlyTools = false,
  }: QueryMemoriesOptions = {}
): Promise<ScoredPineconeRecord<PineconeMetadataOutput>[]> => {
  const now = Date.now();
  const filter: Record<string, any> = {};

  if (ignoreRecent) {
    filter.creation_time = { $lt: now - 60_000 };
  }

  if (ageLimit != null) {
    filter.creation_time = {
      ...filter.creation_time,
      $gt: now - ageLimit,
    };
  }

  if (onlyTools) {
    filter.type = { $eq: 'tool' };
  }

  try {
    const results = await searchMemories(query, {
      topK: limit,
      filter: Object.keys(filter).length ? filter : undefined,
    });

    log.debug(
      {
        query,
        limit,
        ageLimit,
        ignoreRecent,
        onlyTools,
        resultIds: results.map((r) => `${r.id.slice(0, 16)}...`),
      },
      'Long term memory query completed'
    );

    const index = await getIndex();
    await Promise.all(
      results.map(({ id }) =>
        index.update({ id, metadata: { last_retrieval_time: now } })
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
        log.warn(
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
    log.error({ error }, 'Error searching memories');
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
      log.warn(
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

    log.info({ id }, 'Added memory');
    return id;
  } catch (error) {
    log.error({ error }, 'Error adding memory');
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
    log.info({ id }, 'Deleted memory');
  } catch (error) {
    log.error({ error }, 'Error deleting memory');
    throw error;
  }
};
