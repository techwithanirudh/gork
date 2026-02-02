import { createLogger } from '@/lib/logger';
import { isSnowflake } from '@/lib/memory/honcho';
import { tool } from 'ai';
import type { Guild, Message, User } from 'discord.js';
import { z } from 'zod';

const logger = createLogger('tools:user-info');

async function fetchUserById(
  message: Message,
  userId: string,
): Promise<User | null> {
  try {
    return await message.client.users.fetch(userId);
  } catch {
    return null;
  }
}

function matchGuildMember(guild: Guild | null, input: string): User | null {
  if (!guild) return null;
  const needle = input.toLowerCase();
  const member = guild.members.cache.find(
    (m) =>
      m.user.username.toLowerCase() === needle ||
      m.displayName.toLowerCase() === needle ||
      m.user.tag?.toLowerCase() === needle,
  );
  return member?.user ?? null;
}

function matchCachedUser(message: Message, input: string): User | null {
  const needle = input.toLowerCase();
  const matches = message.client.users.cache.filter((u) => {
    const tag = u.tag?.toLowerCase();
    return u.username.toLowerCase() === needle || tag === needle;
  });

  if (matches.size === 1) return matches.first() ?? null;
  return null;
}

async function resolveUser(
  message: Message,
  input: string,
): Promise<User | null> {
  if (isSnowflake(input)) {
    return fetchUserById(message, input);
  }

  const guildMatch = matchGuildMember(message.guild, input);
  if (guildMatch) return guildMatch;

  return matchCachedUser(message, input);
}

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
