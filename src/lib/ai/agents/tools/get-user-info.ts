import { createLogger } from '@/lib/logger';
import { resolveUser } from '@/lib/discord/resolve-user';
import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';

const logger = createLogger('tools:user-info');

export const getUserInfo = ({ message }: { message: Message }) =>
  tool({
    description:
      'Get detailed information about a Discord user by their username, tag, display name, or ID.',
    inputSchema: z.object({
      userId: z
        .string()
        .describe(
          'The ID, username, tag, or display name of the user to look up.',
        ),
    }),
    execute: async ({ userId }) => {
      try {
        const user = await resolveUser(message, userId);

        if (!user) {
          return {
            success: false,
            error: 'User not found',
          };
        }

        return {
          success: true,
          data: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            tag: user.tag,
            bot: user.bot,
            createdAt: user.createdAt.toISOString(),
            avatarURL: user.displayAvatarURL(),
            flags: user.flags?.toArray() || [],
          },
        };
      } catch (error) {
        logger.error({ error }, 'Error in getUserInfo:');
        return {
          success: false,
          error: 'Failed to fetch user information',
        };
      }
    },
  });
