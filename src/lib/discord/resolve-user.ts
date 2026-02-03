import { isSnowflake } from '@/lib/memory/honcho';
import type { Guild, Message, User } from 'discord.js';

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

export async function resolveUser(
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

export async function resolveUserId(
  message: Message,
  input: string,
): Promise<string | null> {
  const user = await resolveUser(message, input);
  return user?.id ?? null;
}
