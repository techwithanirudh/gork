import { createLogger } from '@/lib/logger';
import { resolveUser } from '@/lib/discord/resolve-user';
import { getHonchoClient, resolvePeerId } from '@/lib/memory';
import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';

const logger = createLogger('tools:discord-user');
const client = getHonchoClient();

export const getDiscordUser = ({ message }: { message: Message }) =>
  tool({
    description: 'Get a Discord user profile by username, tag, or ID.',
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

        const peer = await client.peer(resolvePeerId(user.id));
        const peerCard = await peer.card();

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
