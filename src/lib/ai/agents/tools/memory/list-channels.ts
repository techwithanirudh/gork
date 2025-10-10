import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';

export const listChannels = ({ message }: { message: Message }) =>
  tool({
    description:
      'List channels for a guild. Filterable by name, supports text/news/forum channels.',
    inputSchema: z.object({
      guildId: z.string().describe('Guild ID to list channels for'),
      query: z
        .string()
        .optional()
        .describe('Optional channel name query (case-insensitive substring).'),
      limit: z
        .number()
        .int()
        .positive()
        .max(50)
        .optional()
        .describe('Optional max number of channels to return (default all up to 50).'),
    }),
    execute: async ({ guildId, query, limit }) => {
      const guild = message.client.guilds.cache.get(guildId);
      if (!guild) {
        return [];
      }

      const normalizedQuery = (query ?? '').trim().toLowerCase();
      const channels = guild.channels.cache
        .filter((c) => c.isTextBased())
        .filter((c) => {
          if (!normalizedQuery) return true;
          return (c.name ?? '').toLowerCase().includes(normalizedQuery);
        })
        .map((c) => ({ id: c.id, name: c.name, type: c.type }))
        .slice(0, limit ?? 50);

      return channels;
    },
  });


