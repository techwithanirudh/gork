import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';

export const listUsers = ({ message }: { message: Message }) =>
  tool({
    description:
      'List users by guild or channel. Supports name query and limit.',
    inputSchema: z.object({
      guildId: z.string().optional().describe('Optional guild ID scope'),
      channelId: z
        .string()
        .optional()
        .describe('Optional channel ID scope (overrides guild scope when provided).'),
      query: z
        .string()
        .optional()
        .describe('Optional case-insensitive substring match on username or nickname'),
      limit: z
        .number()
        .int()
        .positive()
        .max(100)
        .optional()
        .describe('Optional max number of results to return (default 25).'),
    }),
    execute: async ({ guildId, channelId, query, limit }) => {
      const normalizedQuery = (query ?? '').trim().toLowerCase();
      const max = limit ?? 25;

      if (channelId) {
        const channel = message.client.channels.cache.get(channelId);
        if (!channel || !('members' in channel)) return [];
        // @ts-ignore: discord.js typings vary by channel type; we guard via 'in'
        const members = channel.members as Map<string, any> | undefined;
        if (!members) return [];
        const users = [...members.values()]
          .map((m) => ({
            id: m.user?.id ?? m.id,
            username: m.user?.username ?? m.user?.tag ?? m.id,
            nickname: m.nickname ?? undefined,
          }))
          .filter((u) => {
            if (!normalizedQuery) return true;
            const name = `${u.username} ${u.nickname ?? ''}`.toLowerCase();
            return name.includes(normalizedQuery);
          })
          .slice(0, max);
        return users;
      }

      if (guildId) {
        const guild = message.client.guilds.cache.get(guildId);
        if (!guild) return [];
        await guild.members.fetch();
        const users = guild.members.cache
          .map((m) => ({
            id: m.user.id,
            username: m.user.username,
            nickname: m.nickname ?? undefined,
          }))
          .filter((u) => {
            if (!normalizedQuery) return true;
            const name = `${u.username} ${u.nickname ?? ''}`.toLowerCase();
            return name.includes(normalizedQuery);
          })
          .slice(0, max);
        return users;
      }

      // No scope specified
      return [];
    },
  });


