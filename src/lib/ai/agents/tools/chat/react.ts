import { createLogger } from '@/lib/logger';
import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';

const logger = createLogger('tools:react');

export const react = ({ message }: { message: Message }) =>
  tool({
    description:
      'React to a message on discord with one or more emojis. If no ID is provided, reacts to the latest message (the provided message).',
    inputSchema: z.object({
      emojis: z
        .array(z.string())
        .describe('Array of emojis to react with (unicode or custom)'),
      id: z
        .string()
        .trim()
        .optional()
        .describe(
          'The ID of the message to react to (optional). If omitted, reacts to the latest message (the provided message).'
        ),
      // author: z.string().describe('The author of the message to react to'),
    }),
    execute: async ({ id, emojis }) => {
      try {
        const { channel } = message;
        const target =
          id && id.length > 0 ? await channel.messages.fetch(id) : message;

        if (!target) {
          logger.warn({ id }, 'Message not found');
          return { success: false, error: 'Message not found' };
        }

        for (const emoji of emojis) {
          await target.react(emoji);
        }

        logger.info({ id: id ?? message.id, emojis }, 'Reacted to message');

        return {
          success: true,
          content: `Reacted with ${emojis.join(', ')}`,
        };
      } catch (error) {
        logger.error(
          { error, id: id ?? message.id, emojis },
          'Failed to react to message'
        );
        return {
          success: false,
          error: String(error),
        };
      }
    },
  });
