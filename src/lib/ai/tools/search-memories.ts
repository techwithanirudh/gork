import logger from '@/lib/logger';
import { searchMemories as searchPineconeMemories } from '@/lib/pinecone/queries';
import type { MinimalContext } from '@/utils/messages';
import { tool } from 'ai';
import { z } from 'zod/v4';

export const searchMemories = ({ message }: { message: MinimalContext }) =>
  tool({
    description: 'Search through stored memories using a text query.',
    parameters: z.object({
      query: z.string().describe('The text query to search for in memories'),
      namespace: z
        .string()
        .optional()
        .describe('Optional namespace to search in (defaults to "default")'),
      topK: z
        .number()
        .optional()
        .describe('Optional number of results to return (defaults to 5)'),
    }),
    execute: async ({ query, namespace, topK }) => {
      try {
        const results = await searchPineconeMemories(query, {
          namespace,
          topK,
        });

        return {
          success: true,
          data: results.map((result) => ({
            score: result.score,
            text: result.metadata?.text,
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
