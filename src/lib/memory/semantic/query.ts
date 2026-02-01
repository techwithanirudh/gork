import { createLogger } from '@/lib/logger';
import type { PineconeMetadataOutput } from '@/types';
import type { ScoredPineconeRecord } from '@pinecone-database/pinecone';
import { searchMemories } from './search';

const logger = createLogger('memory:semantic:query');

export interface QueryOptions {
  namespace?: string;
  limit?: number;
  ageLimit?: number;
  ignoreRecent?: boolean;
  onlyTools?: boolean;
  filter?: Record<string, unknown>;
}

export async function queryMemories(
  query: string,
  {
    namespace = 'default',
    limit = 4,
    ageLimit,
    ignoreRecent = true,
    onlyTools = false,
    filter: customFilter,
  }: QueryOptions = {},
): Promise<ScoredPineconeRecord<PineconeMetadataOutput>[]> {
  if (!query?.trim()) {
    return [];
  }

  const now = Date.now();
  const filter: Record<string, unknown> = { ...(customFilter ?? {}) };

  if (!('version' in filter)) {
    filter.version = { $eq: 2 };
  }

  if (ignoreRecent) {
    const existingCreatedAt =
      (filter.createdAt as Record<string, unknown>) ?? {};
    filter.createdAt = {
      ...existingCreatedAt,
      $lt: now - 60_000,
    };
  }

  if (ageLimit != null) {
    const existingCreatedAt =
      (filter.createdAt as Record<string, unknown>) ?? {};
    filter.createdAt = {
      ...existingCreatedAt,
      $gt: now - ageLimit,
    };
  }

  if (onlyTools && filter.type == null) {
    filter.type = { $eq: 'tool' };
  }

  try {
    return await searchMemories(query, {
      namespace,
      topK: limit,
      filter: Object.keys(filter).length ? filter : undefined,
    });
  } catch (error) {
    logger.error({ error, query }, 'Error querying memories');
    return [];
  }
}
