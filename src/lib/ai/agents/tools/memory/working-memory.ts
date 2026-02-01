import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import {
  scopedUserId,
  getAllMemories,
  searchMemories,
  deleteMemory,
  formatAllMemories,
} from '@/lib/memory/mem0';

const logger = createLogger('tools:working-memory');

/**
 * forgetFact - Remove a memory by searching for matching content
 * Since mem0 auto-extracts facts, we search for memories matching the content
 * and delete them.
 */
export const forgetFact = ({ message }: { message: Message }) =>
  tool({
    description:
      "Remove outdated or incorrect information from a user's memory. " +
      'Searches for memories matching the content and deletes them.',
    inputSchema: z.object({
      userId: z.string().describe('The Discord user ID'),
      content: z
        .string()
        .describe(
          'The item to forget (will search and delete matching memories)',
        ),
    }),
    execute: async ({ userId, content }) => {
      const guildId = message.guild?.id ?? null;

      try {
        const scopedId = scopedUserId(guildId, userId);

        // Search for memories matching the content
        const matchingMemories = await searchMemories(content, scopedId, {
          limit: 5,
          guildId: guildId ?? undefined,
        });

        if (matchingMemories.length === 0) {
          return {
            success: false,
            error: 'No matching memories found to delete',
          };
        }

        // Delete the most relevant match
        const topMatch = matchingMemories[0]!;
        const deleted = await deleteMemory(topMatch.id);

        if (deleted) {
          logger.info(
            { guildId, userId, content, memoryId: topMatch.id },
            'Removed memory item',
          );
          return {
            success: true,
            message: `Forgot: "${topMatch.content}"`,
          };
        } else {
          return { success: false, error: 'Failed to delete memory' };
        }
      } catch (error) {
        logger.error({ error, userId, guildId }, 'Failed to remove memory');
        return { success: false, error: 'Failed to remove memory' };
      }
    },
  });

/**
 * getMemory - Retrieve all stored memories for a user
 */
export const getMemory = ({ message }: { message: Message }) =>
  tool({
    description:
      'Retrieve all stored information about a user. ' +
      'Use this to check what facts/preferences have been automatically learned.',
    inputSchema: z.object({
      userId: z.string().describe('The Discord user ID to get memory for'),
    }),
    execute: async ({ userId }) => {
      const guildId = message.guild?.id ?? null;

      try {
        const scopedId = scopedUserId(guildId, userId);
        const memories = await getAllMemories(scopedId, {
          limit: 50,
          guildId: guildId ?? undefined,
        });

        const formattedContent = formatAllMemories(memories);

        const firstMemory = memories[0];
        return {
          success: true,
          content: formattedContent,
          memoryCount: memories.length,
          lastUpdated: firstMemory?.createdAt ?? null,
        };
      } catch (error) {
        logger.error(
          { error, userId, guildId },
          'Failed to get working memory',
        );
        return { success: false, error: 'Failed to retrieve memory' };
      }
    },
  });
