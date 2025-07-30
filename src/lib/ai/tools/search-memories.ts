import { createLogger } from '@/lib/logger';
import { queryMemories } from '@/lib/pinecone/operations';
import { tool } from 'ai';
import { z } from 'zod/v4';

const logger = createLogger('tools:search-memories');

export const searchMemories = () =>
  tool({
    description: 'Search through stored memories using a text query.',
    inputSchema: z.object({
      query: z.string().describe('The text query to search for in memories'),
      limit: z
        .number()
        .default(5)
        .describe('Number of results to return (defaults to 5)'),
      options: z
        .object({
          ageLimit: z.number().optional(),
          ignoreRecent: z.boolean().optional(),
          onlyTools: z.boolean().optional(),
        })
        .optional(),
    }),
    execute: async ({ query, limit, options }) => {
      try {
        const results = await queryMemories(query, {
          limit,
          ...options,
        });

        logger.info({ results }, 'Memory search results');

        return {
          success: true,
          data: results.map((result) => ({
            score: result.score,
            metadata: result.metadata,
          })),
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
