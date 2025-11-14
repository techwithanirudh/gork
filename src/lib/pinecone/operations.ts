import { createLogger } from '@/lib/logger';

import type { PineconeMetadataOutput } from '@/types';
import { type ScoredPineconeRecord } from '@pinecone-database/pinecone';
import { getIndex } from './index';
import { searchMemories } from './queries';

const logger = createLogger('pinecone:operations');

export interface QueryMemoriesOptions {
  namespace?: string;
  limit?: number;
  ageLimit?: number;
  ignoreRecent?: boolean;
  onlyTools?: boolean;
  filter?: Record<string, unknown>;
}

export const queryMemories = async (
  query: string,
  {
    namespace = 'default',
    limit = 4,
    ageLimit,
    ignoreRecent = true,
    onlyTools = false,
    filter: customFilter,
  }: QueryMemoriesOptions = {}
): Promise<ScoredPineconeRecord<PineconeMetadataOutput>[]> => {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const now = Date.now();
  const filter: Record<string, unknown> = { ...(customFilter ?? {}) };

  if (!('version' in filter)) {
    filter.version = { $eq: 2 };
  }

  if (ignoreRecent) {
    const existingCreatedAt =
      (filter.createdAt as Record<string, unknown> | undefined) ?? {};
    filter.createdAt = {
      ...existingCreatedAt,
      $lt: now - 60_000,
    };
  }

  if (ageLimit != null) {
    const existingCreatedAt =
      (filter.createdAt as Record<string, unknown> | undefined) ?? {};
    filter.createdAt = {
      ...existingCreatedAt,
      $gt: now - ageLimit,
    };
  }

  if (onlyTools && filter.type == null) {
    filter.type = { $eq: 'tool' };
  }

  try {
    const results = await searchMemories(query, {
      namespace,
      topK: limit,
      filter: Object.keys(filter).length ? filter : undefined,
    });

    const index = (await getIndex()).namespace(namespace);
    await Promise.all(
      results.map(({ id }: { id: string }) =>
        index.update({ id, metadata: { lastRetrievalTime: Date.now() } })
      )
    );

    return results;
  } catch (error) {
    logger.error({ error, query }, 'Error querying long term memory');
    return [];
  }
};
