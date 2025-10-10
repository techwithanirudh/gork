import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';

export const listGuilds = ({ message }: { message: Message }) =>
  tool({
    description: 'List all guilds the bot is in',
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe('Optional name query to filter guilds'),
    }),
    execute: async ({ query }) => {
      const normalizedQuery = (query ?? '').trim().toLowerCase();
      const guilds = message.client.guilds.cache.filter((guild) => {
        if (!normalizedQuery) return true;
        return guild.name.toLowerCase().includes(normalizedQuery);
      });

      return guilds.map((guild) => ({
        id: guild.id,
        name: guild.name,
      }));
    },
  });
