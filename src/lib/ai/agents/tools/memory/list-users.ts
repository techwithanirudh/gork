import { tool } from 'ai';
import type { Collection, GuildMember, Message } from 'discord.js';
import { z } from 'zod';
import { createFuzzySearch } from '../../utils/fuzzy';

export const listUsers = ({ message }: { message: Message }) =>
  tool({
    description:
      'List users by guild or channel. Supports name query and limit.',
    inputSchema: z.object({
      guildId: z.string().optional().describe('Optional guild ID scope'),
      channelId: z
        .string()
        .optional()
        .describe(
          'Optional channel ID scope (overrides guild scope when provided).'
        ),
      query: z
        .string()
        .optional()
        .describe(
          'Optional case-insensitive substring match on username or nickname'
        ),
      limit: z
        .number()
        .int()
        .positive()
        .max(100)
        .optional()
        .describe('Optional max number of results to return (default 25).'),
    }),
    execute: async ({ guildId, channelId, query, limit }) => {
      const max = limit ?? 25;

      if (channelId) {
        const channel = message.client.channels.cache.get(channelId);
        if (!channel || !('members' in channel)) return [];
        // @ts-ignore: discord.js typings vary by channel type; we guard via 'in'
        const members = channel.members as Collection<string, GuildMember>;
        if (!members) return [];
        const all = [...members.values()].map((m) => ({
          id: m.user?.id ?? m.id,
          username: m.user?.username ?? m.user?.tag,
          displayName: m.user?.displayName ?? m.displayName,
          nickname: m.nickname,
        }));
        const { search } = createFuzzySearch(all, [
          'username',
          'nickname',
          'id',
          'displayName',
        ]);
        return search(query, max);
      }

      if (guildId) {
        const guild = message.client.guilds.cache.get(guildId);
        if (!guild) return [];
        await guild.members.fetch();
        const all = guild.members.cache.map((m) => ({
          id: m.user?.id ?? m.id,
          username: m.user?.username ?? m.user?.tag,
          displayName: m.user?.displayName ?? m.displayName,
          nickname: m.nickname,
        }));
        const { search } = createFuzzySearch(all, [
          'username',
          'nickname',
          'id',
          'displayName',
        ]);
        return search(query, max);
      }

      // No scope specified
      return [];
    },
  });
