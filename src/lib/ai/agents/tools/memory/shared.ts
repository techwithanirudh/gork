import { resolveUserId as resolveDiscordUserId } from '@/lib/discord/resolve-user';
import {
  getContextFromMessage,
  getHonchoClient,
  resolvePeerId,
  getSessionId,
} from '@/lib/memory';
import type { Message } from 'discord.js';

export const client = getHonchoClient();

export async function resolveUserId(message: Message, userId?: string) {
  const ctx = getContextFromMessage(message);
  if (!userId) return { ctx, userId: ctx.userId };

  const resolvedUserId = await resolveDiscordUserId(message, userId);
  return { ctx, userId: resolvedUserId ?? null };
}

export async function getPeerByUserId(userId: string) {
  return client.peer(resolvePeerId(userId));
}

export async function getSessionForContext(
  ctx: ReturnType<typeof getContextFromMessage>,
) {
  return client.session(getSessionId(ctx));
}
