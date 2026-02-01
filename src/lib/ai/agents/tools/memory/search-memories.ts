import { formatMemories, queryMemories } from '@/lib/memory';
import { createLogger } from '@/lib/logger';
import { ALLOWED_MEMORY_FILTERS } from '@/lib/validators/pinecone';
import { tool } from 'ai';
import { z } from 'zod';
import type { MemoryContext } from '../chat/memories';

const logger = createLogger('tools:search-memories');
const MIN_SCORE_THRESHOLD = 0.3;

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
        .describe('Metadata filters. REQUIRED: { "guildId": { "$eq": "ID" } }'),
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

const ALLOWED_FILTER_KEYS = new Set<string>(ALLOWED_MEMORY_FILTERS);

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

function applyContextDefaults(
  filter?: Record<string, unknown>,
  context?: MemoryContext,
): Record<string, unknown> | undefined {
  if (!context?.guildId) return filter;

  const result = { ...(filter ?? {}) };
  if (!('guildId' in result)) {
    result.guildId = { $eq: context.guildId };
  }

  return Object.keys(result).length ? result : undefined;
}
