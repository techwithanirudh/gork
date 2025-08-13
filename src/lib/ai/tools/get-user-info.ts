import { createLogger } from '@/lib/logger';
import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod/v4';

const logger = createLogger('tools:user-info');

export const getUserInfo = ({ message }: { message: Message }) =>
  tool({
    description:
      'Get detailed information about a Discord user by their username or ID.',
    inputSchema: z.object({
      userId: z
        .string()
        .describe('The ID or username of the user to get information about.'),
    }),
    execute: async ({ userId }) => {
      try {
        let user;

        try {
          user = await message.client.users.fetch(userId);
        } catch {
          const users = message.client.users.cache.filter(
            (u) => u.username === userId
          );
          if (users.size === 1) {
            user = users.first();
          } else if (users.size > 1) {
            return {
              success: false,
              error:
                'Multiple users found with that username. Please use ID instead.',
            };
          }
        }

        if (!user) {
          return {
            success: false,
            error: 'User not found',
          };
        }

        // Try to fetch user profile for bio information
        let bio = null;
        try {
          const profile = await user.getProfile();
          bio = profile.bio || null;
        } catch {
          // Profile fetching failed, bio will remain null
        }

        return {
          success: true,
          data: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            description: bio,
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
