import { createLogger } from '@/lib/logger';
import { resolveUser } from '@/lib/discord/resolve-user';
import { getPeerCard } from '@/lib/memory/honcho';
import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';

const logger = createLogger('tools:user-profile');

export const getUserProfile = ({ message }: { message: Message }) =>
  tool({
    description:
      'Get a Discord user profile with Honcho memory summary (peer card).',
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

        const peerCard = await getPeerCard(user.id);

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
            summary: peerCard?.length ? peerCard : [],
          },
        };
      } catch (error) {
        logger.error({ error }, 'Error in getUserProfile:');
        return {
          success: false,
          error: 'Failed to fetch user information',
        };
      }
    },
  });
