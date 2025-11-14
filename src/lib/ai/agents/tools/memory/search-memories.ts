import { formatMemories } from '@/lib/ai/memory/format';
import { createLogger } from '@/lib/logger';
import { queryMemories } from '@/lib/pinecone/operations';
import { ALLOWED_MEMORY_FILTERS } from '@/lib/validators/pinecone';
import { tool } from 'ai';
import { z } from 'zod';

const logger = createLogger('tools:search-memories');

export const searchMemories = () =>
  tool({
    description:
      'Search through stored memories using a text query. Valid filter keys: ' +
      ALLOWED_MEMORY_FILTERS.join(', '),
    inputSchema: z.object({
      query: z.string().describe('The text query to search for in memories'),
      limit: z
        .number()
        .int()
        .positive()
        .max(20)
        .default(5)
        .describe('Number of results to return (defaults to 5, max 20)'),
      options: z
        .object({
          // ageLimitDays converts to ms in the executor for clarity
          ageLimitDays: z
            .number()
            .int()
            .positive()
            .optional()
            .describe(
              'Number of days to limit results to (e.g. 7 for last week)'
            ),
          ignoreRecent: z
            .boolean()
            .optional()
            .describe('Whether to ignore recent memories'),
          onlyTools: z
            .boolean()
            .optional()
            .describe('Whether to only return tool memories'),
        })
        .optional(),
      filter: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
          'Metadata filters to apply (e.g. { guildId: "123", type: { $in: ["summary"] } })'
        ),
    }),
    execute: async ({ query, limit, options, filter }) => {
      try {
        if (!query || query.trim().length === 0) {
          return {
            success: true,
            data: {
              memories: '',
              query: '',
              limit,
              options: options ?? null,
              filter: null,
              message:
                'No query provided. Please supply a semantic search phrase before calling this tool.',
            },
          };
        }

        const sanitizedFilter = sanitizeFilter(filter);
        const results = await queryMemories(query, {
          limit,
          ageLimit: options?.ageLimitDays
            ? options.ageLimitDays * 24 * 60 * 60 * 1000
            : undefined,
          ignoreRecent: options?.ignoreRecent,
          onlyTools: options?.onlyTools,
          filter: sanitizedFilter,
        });

        const memories = formatMemories(results);
        const trimmedQuery = query.trim();

        return {
          success: true,
          data: {
            memories,
            query: trimmedQuery,
            limit,
            options: options ?? null,
            filter: sanitizedFilter ?? null,
            message: memories
              ? 'Memory search completed.'
              : 'No matching memories found for this scope.',
          },
        };
      } catch (error) {
        logger.error({ error }, 'Error in searchMemories tool');
        return {
          success: false,
          error: 'Failed to search memories',
        };
      }
    },
  });

const ALLOWED_FILTER_KEYS = new Set<string>(ALLOWED_MEMORY_FILTERS);

function sanitizeFilter(
  filter?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!filter) return undefined;

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filter)) {
    if (!ALLOWED_FILTER_KEYS.has(key)) continue;
    cleaned[key] = value;
  }

  return Object.keys(cleaned).length ? cleaned : undefined;
}
