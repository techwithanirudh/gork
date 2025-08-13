import { createLogger } from '@/lib/logger';
import { tool } from 'ai';
import type { Message, TextBasedChannel } from 'discord.js';
import { z } from 'zod';

const logger = createLogger('tools:get-messages');

export const getMessages = ({ message }: { message: Message }) =>
  tool({
    description:
      'Fetch recent messages in the current channel. Use anchor+direction to avoid drift: anchor defaults to the provided message.',
    inputSchema: z.object({
      limit: z
        .number()
        .int()
        .positive()
        .max(100)
        .default(25)
        .describe('Number of recent messages to fetch (max 100).'),
      anchor: z
        .object({
          id: z.string().optional().describe('Anchor message ID; defaults to the provided message'),
          position: z
            .enum(['before', 'after', 'around'])
            .default('before')
            .describe('Fetch messages relative to the anchor: before, after, or around'),
        })
        .optional(),
    }),
    execute: async ({ limit, anchor }) => {
      try {
        const channel = message.channel as TextBasedChannel;
        if (!('messages' in channel) || typeof channel.messages?.fetch !== 'function') {
          return { success: false, error: 'Channel does not support fetching messages' };
        }

        const resolvedLimit = typeof limit === 'number' && !Number.isNaN(limit) ? limit : 25;
        const anchorId = anchor?.id || message.id;
        const position = anchor?.position || 'before';

        let fetched;
        if (position === 'before') {
          fetched = await channel.messages.fetch({ limit: resolvedLimit, before: anchorId });
        } else if (position === 'after') {
          fetched = await channel.messages.fetch({ limit: resolvedLimit, after: anchorId });
        } else {
          // around: fetch both sides conservatively and merge
          const half = Math.max(1, Math.floor(resolvedLimit / 2));
          const before = await channel.messages.fetch({ limit: half, before: anchorId });
          const after = await channel.messages.fetch({ limit: resolvedLimit - half, after: anchorId });
          fetched = before.concat(after);
        }

        const list = Array.from(fetched.values())
          .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
          .map((m) => ({
            id: m.id,
            author: m.author?.username ?? 'unknown',
            createdAt: new Date(m.createdTimestamp).toISOString(),
            content: m.content,
            offsetFromAnchor: m.id === anchorId ? 0 : undefined,
          }));

        logger.info({ count: list.length }, 'Fetched recent messages');
        return { success: true, messages: list };
      } catch (error) {
        logger.error({ error }, 'Failed to fetch recent messages');
        return { success: false, error: String(error) };
      }
    },
  });


