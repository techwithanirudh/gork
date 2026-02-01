import { deleteMemory as deleteMem0Memory } from '@/lib/memory';
import { createLogger } from '@/lib/logger';
import { tool } from 'ai';
import { z } from 'zod';

const logger = createLogger('tools:delete-memory');

export const deleteMemory = () =>
  tool({
    description: 'Delete a memory by its exact memoryId.',
    inputSchema: z.object({
      memoryId: z.string().describe('Exact memory ID to delete'),
    }),
    execute: async ({ memoryId }) => {
      try {
        const deleted = await deleteMem0Memory(memoryId);
        return {
          success: deleted,
          message: deleted ? 'Memory deleted.' : 'Failed to delete memory.',
        };
      } catch (error) {
        logger.error({ error, memoryId }, 'Failed to delete memory');
        return { success: false, error: 'Failed to delete memory' };
      }
    },
  });
