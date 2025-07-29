import logger from '@/lib/logger';
import type { PineconeMetadataOutput } from '@/types';
import { type ScoredPineconeRecord } from '@pinecone-database/pinecone';
import { getIndex } from './index';
import { searchMemories } from './queries';

export interface QueryMemoriesOptions {
  namespace?: string;
  limit?: number;
  ageLimit?: number;
  ignoreRecent?: boolean;
  onlyTools?: boolean;
}

export const queryMemories = async (
  query: string,
  {
    namespace = 'default',
    limit = 4,
    ageLimit,
    ignoreRecent = true,
    onlyTools = false,
  }: QueryMemoriesOptions = {}
): Promise<ScoredPineconeRecord<PineconeMetadataOutput>[]> => {
  const now = Date.now();
  const filter: Record<string, any> = {};

  if (ignoreRecent) {
    filter.createdAt = { $lt: now - 60_000 };
  }

  if (ageLimit != null) {
    filter.createdAt = {
      ...filter.createdAt,
      $gt: now - ageLimit,
    };
  }

  if (onlyTools) {
    filter.type = { $eq: 'tool' };
  }

  try {
    const results = await searchMemories(query, {
      namespace,
      topK: limit,
      filter: Object.keys(filter).length ? filter : undefined,
    });

    logger.debug(
      {
        query,
        limit,
        ageLimit,
        ignoreRecent,
        onlyTools,
        resultIds: results.map(
          (r: ScoredPineconeRecord<PineconeMetadataOutput>) =>
            `${r.id.slice(0, 16)}...`
        ),
      },
      'Long term memory query completed'
    );

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
