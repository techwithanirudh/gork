import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod/v4';
import { createLogger } from '@/lib/logger';
import { toLogError } from '@/utils/error';

const logger = createLogger('tools:get-users');

export const getUsers = ({ message }: { message: Message }) =>
  tool({
    description:
      'List users in the current channel or server. Use this to find who is in the conversation before pinging someone. To ping a user in your reply, use <@userId> with the id returned here.',
    inputSchema: z.object({
      scope: z
        .enum(['channel', 'guild'])
        .describe(
          'channel: members of the current channel only; guild: all members of the server'
        ),
    }),
    execute: async ({ scope }) => {
      try {
        const guild = message.guild;
        if (!guild) {
          return { success: false, error: 'Not in a server' };
        }

        if (scope === 'channel') {
          const channel = message.channel;
          if (!(channel.isTextBased() && 'members' in channel)) {
            return {
              success: false,
              error: 'Cannot list members for this channel type',
            };
          }
          const members = (
            channel as {
              members: Map<
                string,
                {
                  id: string;
                  displayName: string;
                  user: { username: string; bot: boolean };
                }
              >;
            }
          ).members;
          const users = Array.from(members.values())
            .filter((m) => !m.user.bot)
            .map((m) => ({
              id: m.id,
              username: m.user.username,
              displayName: m.displayName,
            }));
          return { success: true, scope: 'channel', users };
        }

        await guild.members.fetch();
        const users = guild.members.cache
          .filter((m) => !m.user.bot)
          .map((m) => ({
            id: m.id,
            username: m.user.username,
            displayName: m.displayName,
          }));
        return { success: true, scope: 'guild', users };
      } catch (error) {
        logger.error(toLogError(error), 'Error in getUsers');
        return { success: false, error: 'Failed to fetch users' };
      }
    },
  });
