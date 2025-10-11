import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';
import { createFuzzySearch } from '../../utils/fuzzy';

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

      const all = guild.channels.cache
        .filter((c) => c.isTextBased())
        .map((c) => ({ id: c.id, name: c.name, type: c.type }));

      const { search } = createFuzzySearch(all, ['name', 'id']);
      return search(query, limit ?? 50);
    },
  });


