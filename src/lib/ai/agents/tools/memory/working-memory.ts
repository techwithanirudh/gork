import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import {
  getWorkingMemory,
  updateWorkingMemory,
  formatWorkingMemoryContent,
  parseWorkingMemory,
  addToWorkingMemory,
  removeFromWorkingMemory,
} from '@/lib/memory/provider';

const logger = createLogger('tools:working-memory');

export const getMemory = ({ message }: { message: Message }) =>
  tool({
    description:
      'Retrieve stored information about a user (facts, preferences, notes). ' +
      'Use this when you need to recall what you know about someone.',
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
        const content = formatWorkingMemoryContent(memory);
        const parsed = parseWorkingMemory(content);

        return {
          success: true,
          data: {
            raw: content,
            facts: parsed.facts,
            preferences: parsed.preferences,
            notes: parsed.notes,
            totalItems:
              parsed.facts.length +
              parsed.preferences.length +
              parsed.notes.length,
            lastUpdated: memory?.updatedAt?.toISOString() ?? null,
          },
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

export const rememberFact = ({ message }: { message: Message }) =>
  tool({
    description:
      'Store a fact, preference, or note about a user. ' +
      'Use "fact" for things you learned (timezone, name, role), ' +
      '"preference" for likes/dislikes, "note" for other context.',
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
        const existing = await getWorkingMemory({ guildId, userId });
        const currentContent = formatWorkingMemoryContent(existing);
        const section =
          type === 'fact'
            ? 'facts'
            : type === 'preference'
              ? 'preferences'
              : 'notes';
        const updatedContent = addToWorkingMemory(
          currentContent,
          section,
          content,
        );

        await updateWorkingMemory({ guildId, userId, content: updatedContent });
        logger.info({ guildId, userId, type, content }, 'Stored memory item');

        return {
          success: true,
          data: { message: `Remembered: "${content}"`, type },
        };
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
        const existing = await getWorkingMemory({ guildId, userId });
        if (!existing?.content) {
          return { success: false, error: 'No memory found for this user' };
        }

        const updatedContent = removeFromWorkingMemory(
          existing.content,
          content,
        );
        if (updatedContent === existing.content) {
          return { success: false, error: 'Item not found in memory' };
        }

        await updateWorkingMemory({ guildId, userId, content: updatedContent });
        logger.info({ guildId, userId, content }, 'Removed memory item');

        return { success: true, data: { message: `Forgot: "${content}"` } };
      } catch (error) {
        logger.error({ error, userId, guildId }, 'Failed to remove memory');
        return { success: false, error: 'Failed to remove memory' };
      }
    },
  });

export const updateMemory = ({ message }: { message: Message }) =>
  tool({
    description:
      'Replace the entire working memory for a user. Use for major reorganizations. ' +
      'Must follow markdown format with ## Facts, ## Preferences, ## Notes sections.',
    inputSchema: z.object({
      userId: z.string().describe('The Discord user ID'),
      content: z.string().describe('The new memory content in markdown format'),
    }),
    execute: async ({ userId, content }) => {
      const guildId = message.guild?.id;
      if (!guildId) {
        return { success: false, error: 'Cannot update memory in DMs' };
      }

      try {
        await updateWorkingMemory({ guildId, userId, content });
        logger.info({ guildId, userId }, 'Updated entire working memory');
        return {
          success: true,
          data: { message: 'Memory updated successfully' },
        };
      } catch (error) {
        logger.error({ error, userId, guildId }, 'Failed to update memory');
        return { success: false, error: 'Failed to update memory' };
      }
    },
  });
