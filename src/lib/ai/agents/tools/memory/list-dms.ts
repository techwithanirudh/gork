import { tool } from 'ai';
import type { Message, DMChannel, PartialGroupDMChannel } from 'discord.js';
import { z } from 'zod';

export const listDMs = ({ message }: { message: Message }) =>
  tool({
    description: 'List recent DM channels known to the bot user.',
    inputSchema: z.object({
      limit: z
        .number()
        .int()
        .positive()
        .max(50)
        .optional()
        .describe('Optional maximum number to return (default 25).'),
    }),
    execute: async ({ limit }) => {
      const max = limit ?? 25;
      // Discord.js client does not keep a full DM channel cache reliably.
      // We surface whatever is in cache, sorted by lastMessageId when available.
      const channels = [...message.client.channels.cache.values()]
        .filter(
          (c): c is DMChannel | PartialGroupDMChannel => c.isDMBased?.() ?? false
        )
        .sort((a, b) => {
          const aId = a.lastMessageId ?? '0';
          const bId = b.lastMessageId ?? '0';
          return bId.localeCompare(aId);
        })
        .slice(0, max)
        .map((c) => ({ id: c.id, type: c.type }));

      return channels;
    },
  });


