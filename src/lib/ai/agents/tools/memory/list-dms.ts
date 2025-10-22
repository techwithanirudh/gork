import { tool } from 'ai';
import type {
  DMChannel,
  PartialGroupDMChannel,
  PartialDMChannel,
  Message,
  User,
} from 'discord.js';
import { z } from 'zod';

function snowflakeToBigInt(id?: string | null): bigint {
  if (!id) return 0n;
  try {
    return BigInt(id);
  } catch {
    return 0n;
  }
}

function getParticipantIds(
  chan: DMChannel | PartialGroupDMChannel | PartialDMChannel
): string[] {
  const anyChan = chan as any;

  if (Array.isArray(anyChan.recipientIds)) {
    return anyChan.recipientIds.filter((x: unknown): x is string => typeof x === 'string');
  }

  if (typeof anyChan.recipientId === 'string') {
    return [anyChan.recipientId];
  }

  if (anyChan.recipients && typeof anyChan.recipients.forEach === 'function') {
    const ids: string[] = [];
    anyChan.recipients.forEach((u: User) => {
      if (u?.id) ids.push(u.id);
    });
    return ids;
  }

  return [];
}

async function fetchUser(
  client: Message['client'],
  userId: string
): Promise<Pick<User, 'id' | 'username' | 'displayName'>> {
  const cached = client.users.cache.get(userId);
  if (cached) {
    return {
      id: cached.id,
      username: cached.username,
      displayName: cached.displayName,
    };
  }

  try {
    const fetched = await client.users.fetch(userId);
    return {
      id: fetched.id,
      username: fetched.username,
      displayName: fetched.displayName,
    };
  } catch {
    return { id: userId, username: 'unknown', displayName: 'unknown' };
  }
}

export const listDMs = ({ message }: { message: Message }) =>
  tool({
    description: 'List recent DM channels known to the bot user.',
    inputSchema: z.object({
      limit: z
        .number()
        .int()
        .positive()
        .max(50)
        .optional()
        .describe('Optional maximum number to return (default 25).'),
    }),
    execute: async ({ limit }) => {
      const max = limit ?? 25;

      const dmLike = [...message.client.channels.cache.values()]
        .filter((m) => m.isDMBased());
      dmLike.sort((a, b) => {
        const aTime = snowflakeToBigInt(a.lastMessageId);
        const bTime = snowflakeToBigInt(b.lastMessageId);
        return bTime === aTime ? 0 : bTime > aTime ? 1 : -1;
      });

      const selected = dmLike.slice(0, max);
      const base = selected.map((c) => ({
        id: c.id,
        type: c.type,
        lastMessageId: c.lastMessageId ?? null,
      }));

      const withUsers = await Promise.all(
        base.map(async (entry) => {
          const chan = message.client.channels.cache.get(entry.id);
          if (!chan?.isDMBased()) {
            return { ...entry, users: [] };
          }

          let participantIds = getParticipantIds(chan);

          if (
            participantIds.length === 0 &&
            'messages' in chan
          ) {
            try {
              const recent = await chan.messages.fetch({ limit: 5 });
              const me = message.client.user?.id;
              const otherIds = new Set<string>();
              recent.forEach((m) => {
                const authorId = m.author?.id;
                if (authorId && authorId !== me) otherIds.add(authorId);
              });
              participantIds = Array.from(otherIds);
            } catch {
            }
          }

          const users = await Promise.all(
            participantIds.map((uid) => fetchUser(message.client, uid))
          );

          return { ...entry, users };
        })
      );

      return withUsers;
    },
  });
