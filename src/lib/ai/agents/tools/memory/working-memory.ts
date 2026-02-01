import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import {
  getWorkingMemory,
  addToWorkingMemory,
  removeFromWorkingMemory,
  WORKING_MEMORY_TEMPLATE,
} from '@/lib/memory/provider';

const logger = createLogger('tools:working-memory');

export const rememberFact = ({ message }: { message: Message }) =>
  tool({
    description:
      'Store a fact, preference, or note about a user. ' +
      'Duplicates are automatically detected and skipped. ' +
      'Use "fact" for things you learned, "preference" for likes/dislikes, "note" for context.',
    inputSchema: z.object({
      userId: z.string().describe('The Discord user ID'),
      content: z
        .string()
        .describe('What to remember. Be specific and concise.'),
      type: z
        .enum(['fact', 'preference', 'note'])
        .describe('Category: fact, preference, or note'),
    }),
    execute: async ({ userId, content, type }) => {
      const guildId = message.guild?.id;
      if (!guildId) {
        return { success: false, error: 'Cannot store memory in DMs' };
      }

      try {
        const section =
          type === 'fact'
            ? 'facts'
            : type === 'preference'
              ? 'preferences'
              : 'notes';

        const result = await addToWorkingMemory({
          guildId,
          userId,
          section,
          item: content,
        });

        if (result.added) {
          logger.info({ guildId, userId, type, content }, 'Stored memory item');
          return { success: true, message: `Remembered: "${content}"` };
        } else {
          return { success: true, message: result.reason ?? 'Already known' };
        }
      } catch (error) {
        logger.error({ error, userId, guildId }, 'Failed to store memory');
        return { success: false, error: 'Failed to store memory' };
      }
    },
  });

export const forgetFact = ({ message }: { message: Message }) =>
  tool({
    description:
      "Remove outdated or incorrect information from a user's memory.",
    inputSchema: z.object({
      userId: z.string().describe('The Discord user ID'),
      content: z.string().describe('The item to forget (will match partially)'),
    }),
    execute: async ({ userId, content }) => {
      const guildId = message.guild?.id;
      if (!guildId) {
        return { success: false, error: 'Cannot modify memory in DMs' };
      }

      try {
        const result = await removeFromWorkingMemory({
          guildId,
          userId,
          item: content,
        });

        if (result.removed) {
          logger.info({ guildId, userId, content }, 'Removed memory item');
          return { success: true, message: `Forgot: "${content}"` };
        } else {
          return { success: false, error: result.reason ?? 'Not found' };
        }
      } catch (error) {
        logger.error({ error, userId, guildId }, 'Failed to remove memory');
        return { success: false, error: 'Failed to remove memory' };
      }
    },
  });

export const getMemory = ({ message }: { message: Message }) =>
  tool({
    description:
      'Retrieve stored information about a user. ' +
      'Use this to check what you know before adding new facts.',
    inputSchema: z.object({
      userId: z.string().describe('The Discord user ID to get memory for'),
    }),
    execute: async ({ userId }) => {
      const guildId = message.guild?.id;
      if (!guildId) {
        return { success: false, error: 'Cannot retrieve memory in DMs' };
      }

      try {
        const memory = await getWorkingMemory({ guildId, userId });
        return {
          success: true,
          content: memory?.content ?? WORKING_MEMORY_TEMPLATE,
          lastUpdated: memory?.updatedAt?.toISOString() ?? null,
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
