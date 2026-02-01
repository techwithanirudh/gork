import { formatMemories, queryMemories } from '@/lib/memory';
import { createLogger } from '@/lib/logger';
import { tool } from 'ai';
import { z } from 'zod';
import type { MemoryContext } from '../chat/memories';

const logger = createLogger('tools:search-memories');
const MIN_SCORE_THRESHOLD = 0.3;

// Allowed filter keys for mem0 (updated from Pinecone keys)
const ALLOWED_FILTER_KEYS = new Set<string>([
  'guildId',
  'channelId',
  'type',
  'participantIds',
  'sessionId',
  'sessionType',
]);

export const searchMemories = ({ context }: { context?: MemoryContext } = {}) =>
  tool({
    description:
      'Search stored memories using semantic text query. ' +
      'IMPORTANT: Always include guildId filter. For user-specific queries, add participantIds filter.',
    inputSchema: z.object({
      query: z
        .string()
        .describe('Semantic search phrase with multiple related terms'),
      limit: z
        .number()
        .int()
        .positive()
        .max(20)
        .default(5)
        .describe('Number of results (max: 20)'),
      options: z
        .object({
          ageLimitDays: z
            .number()
            .int()
            .positive()
            .nullable()
            .describe('Limit to N days ago'),
          ignoreRecent: z
            .boolean()
            .nullable()
            .describe('Skip memories from last few hours'),
          onlyTools: z
            .boolean()
            .nullable()
            .describe('Only return tool execution memories'),
        })
        .nullable()
        .describe('Time filtering options'),
      filter: z
        .record(z.string(), z.unknown())
        .nullable()
        .describe(
          'Metadata filters using mem0 syntax. ' +
            'Examples: { "guildId": "ID" } for equality, ' +
            '{ "participantIds": { "in": ["id1", "id2"] } } for list membership',
        ),
    }),
    execute: async ({ query, limit, options, filter }) => {
      try {
        if (!query?.trim()) {
          return {
            success: true,
            data: {
              memories: '',
              query: '',
              limit,
              options: options ?? null,
              filter: null,
              message: 'No query provided',
            },
          };
        }

        const sanitizedFilter = sanitizeFilter(filter ?? undefined);
        const finalFilter = applyContextDefaults(sanitizedFilter, context);

        const results = await queryMemories(query, {
          limit,
          ageLimit: options?.ageLimitDays
            ? options.ageLimitDays * 24 * 60 * 60 * 1000
            : undefined,
          ignoreRecent: options?.ignoreRecent ?? undefined,
          onlyTools: options?.onlyTools ?? undefined,
          filter: finalFilter,
        });

        const relevantResults = results.filter(
          (r) => (r.score ?? 0) >= MIN_SCORE_THRESHOLD,
        );
        const memories = formatMemories(relevantResults);

        return {
          success: true,
          data: {
            memories,
            query: query.trim(),
            limit,
            options: options ?? null,
            filter: finalFilter ?? null,
            resultsFound: relevantResults.length,
            filteredOut: results.length - relevantResults.length,
            message: memories
              ? 'Memory search completed.'
              : 'No matching memories found.',
          },
        };
      } catch (error) {
        logger.error({ error }, 'Error in searchMemories tool');
        return { success: false, error: 'Failed to search memories' };
      }
    },
  });

/**
 * Sanitize filter to only include allowed keys
 */
function sanitizeFilter(
  filter?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!filter) return undefined;

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filter)) {
    if (!ALLOWED_FILTER_KEYS.has(key)) continue;
    cleaned[key] = value;
  }

  return Object.keys(cleaned).length ? cleaned : undefined;
}

/**
 * Apply default context values to filter
 * Converts from Pinecone-style $eq syntax to mem0 style if needed
 */
function applyContextDefaults(
  filter?: Record<string, unknown>,
  context?: MemoryContext,
): Record<string, unknown> | undefined {
  if (!context?.guildId) return filter;

  const result = { ...(filter ?? {}) };

  // Add guildId from context if not already present
  if (!('guildId' in result)) {
    // Use direct value (mem0 style) instead of { $eq: value }
    result.guildId = context.guildId;
  } else {
    // Convert Pinecone-style $eq to mem0 style if needed
    const guildIdValue = result.guildId;
    if (
      typeof guildIdValue === 'object' &&
      guildIdValue !== null &&
      '$eq' in guildIdValue
    ) {
      result.guildId = (guildIdValue as Record<string, unknown>).$eq;
    }
  }

  // Convert other Pinecone-style filters to mem0 style
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      if ('$eq' in obj) {
        result[key] = obj.$eq;
      } else if ('$in' in obj) {
        result[key] = { in: obj.$in };
      }
    }
  }

  return Object.keys(result).length ? result : undefined;
}
