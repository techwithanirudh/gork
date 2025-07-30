import { createLogger } from '@/lib/logger';
import { tool } from 'ai';
import type { Message } from 'discord.js-selfbot-v13';
import { z } from 'zod/v4';

const logger = createLogger('tools:reply');

export const reply = ({ message: {
    channel
} }: { message: Message }) =>
  tool({
    description:
      'A tool for providing your final response to a message. This method sends a reply to the message.',
    inputSchema: z.object({
      content: z.array(z.string()).describe('The content of the message to reply with.'),
      id: z.string().describe('The ID of the message to reply to.'),
      type: z.enum(['reply', 'message']).describe('The type of message to send.'),
      author: z.string().describe('The author of the message to react to'),
    }),
    execute: async ({ content, id, type, author }) => {
      const message = await channel.messages.fetch(id);
      if (!message) {
        logger.warn({ id }, 'Message not found');
        return { success: false, error: 'Message not found' };
      }

      try {
        for (let i = 0; i < content.length; i++) {
          if (i === 0 && type === 'reply') {
            await message.reply(content[i] ?? '');
          } else {
            await channel.send(content[i] ?? '');
          }
        }
        return { success: true };
      } catch (error) {
        logger.error({ error, id, content, type }, 'Failed to reply to message');
        return { success: false, error: String(error) };
      }
    },
  });
