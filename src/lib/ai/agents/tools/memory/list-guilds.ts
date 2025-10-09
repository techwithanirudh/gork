import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod/v4';

export const listGuilds = ({ message }: { message: Message }) =>
  tool({
    description: 'List all guilds the bot is in',
    inputSchema: z.object({
      query: z.string().describe('The query to search for in guilds'),
    }),
    execute: async ({ query }) => {
      const guilds = message.client.guilds.cache.filter((guild) =>
        guild.name.toLowerCase().includes(query.toLowerCase())
      );

      return guilds.map((guild) => ({
        id: guild.id,
        name: guild.name,
      }));
    },
  });
