import {
  getContextFromMessage,
  getHonchoClient,
  resolvePeerId,
  getSessionId,
} from '@/lib/memory';
import type { Message } from 'discord.js';

export const client = getHonchoClient();

export async function getPeerByUserId(userId: string) {
  return client.peer(resolvePeerId(userId));
}

export async function getSessionForContext(
  ctx: ReturnType<typeof getContextFromMessage>,
) {
  return client.session(getSessionId(ctx));
}
