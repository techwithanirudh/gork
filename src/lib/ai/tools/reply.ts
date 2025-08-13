import { createLogger } from '@/lib/logger';
import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';
import { setTimeout } from 'timers/promises';

const logger = createLogger('tools:reply');

export const reply = ({ message }: { message: Message }) =>
  tool({
    description:
      'Send messages in the channel. For the first line with type "reply", it will thread to the provided message; subsequent lines are sent to the channel. If type is "message", all lines are sent to the channel.',
    inputSchema: z.object({
      content: z.array(z.string()).describe('Lines of text to send'),
      offset: z
        .number()
        .int()
        .min(0)
        .max(100)
        .optional()
        .describe(
          'Optional: how many messages BEFORE the provided message to reply to. 0 or omitted means the provided message; 1 is the previous message; 2 is two messages back, etc.'
        ),
      type: z
        .enum(['reply', 'message'])
        .describe('Whether to reply (threads) or just send'),
      // author: z.string().describe('The author of the message to react to'),
    }),
    execute: async ({ content, type, offset }) => {
      try {
        const channel = message.channel;
        if (!('send' in channel) || typeof channel.send !== 'function') {
          return { success: false, error: 'Channel is not text-based' };
        }
        let target: Message = message;
        const steps = typeof offset === 'number' ? Math.max(0, Math.min(100, offset)) : 0;
        if (steps > 0) {
          const fetched = await channel.messages.fetch({
            limit: steps,
            before: message.id,
          });
          const ordered = Array.from(fetched.values()).sort(
            (a, b) => a.createdTimestamp - b.createdTimestamp
          );
          const nth = ordered[ordered.length - 1];
          if (nth) target = nth as Message;
        }

        for (const [idx, text] of content.entries()) {
          if (idx === 0 && type === 'reply') {
            await target.reply(text);
          } else {
            await channel.send(text);
          }
        }

        logger.info({ id: target.id, content, type, offset: offset ?? 0 }, 'Replied to message');

        return { success: true, content: 'Successfully replied to message. Do NOT repeat the same message again.' };
      } catch (error) {
        logger.error({ error, id: message.id, content, type, offset: offset ?? 0 }, 'Failed to send reply');
        return { success: false, error: String(error) };
      }
    },
  });
