import { createLogger } from '@/lib/logger';
import { tool } from 'ai';
import type { Message } from 'discord.js-selfbot-v13';
import { z } from 'zod';
import { setTimeout } from 'timers/promises';

const logger = createLogger('tools:reply');

export const reply = ({ message: { channel } }: { message: Message }) =>
  tool({
    description:
      'A tool for providing your final response to a message. This method sends a reply to the message.',
    inputSchema: z.object({
      id: z.string().describe('The ID of the message to reply to'),
      content: z.array(z.string()).describe('Lines of text to send'),
      type: z
        .enum(['reply', 'message'])
        .describe('Whether to reply (threads) or just send'),
      // author: z.string().describe('The author of the message to react to'),
    }),
    execute: async ({ id, content, type }) => {
      try {
        const target = await channel.messages.fetch(id);

        if (!target) {
          logger.warn({ id }, 'Message not found');
          return { success: false, error: 'Message not found' };
        }

        await setTimeout(2000);

        for (const [idx, text] of content.entries()) {
          await setTimeout(2500);
          if (idx === 0 && type === 'reply') {
            await target.reply(text);
          } else {
            await channel.send(text);
          }
        }

        logger.info({ id, content, type }, 'Replied to message');

        return { success: true };
      } catch (error) {
        logger.error({ error, id, content, type }, 'Failed to send reply');
        return { success: false, error: String(error) };
      }
    },
  });
