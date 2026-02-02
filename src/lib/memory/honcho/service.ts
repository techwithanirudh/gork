import { createLogger } from '@/lib/logger';
import type { Message, Peer, Session } from '@honcho-ai/sdk';
import { getHonchoClient } from './client';
import type { ContextOptions, ContextResult, MessageContext, SearchResult } from './types';
import { BOT_PEER_ID, resolvePeerId, resolveSessionId, toMetadata } from './utils';

const logger = createLogger('honcho');

let cachedBotPeer: Peer | null = null;

async function getBotPeer(): Promise<Peer> {
  if (cachedBotPeer) return cachedBotPeer;
  const client = getHonchoClient();
  cachedBotPeer = await client.peer(BOT_PEER_ID, {
    configuration: { observeMe: false },
  });
  return cachedBotPeer;
}

async function getPeer(userId: string): Promise<Peer> {
  const client = getHonchoClient();
  return client.peer(resolvePeerId(userId), {
    configuration: { observeMe: true },
  });
}

async function getSession(ctx: MessageContext): Promise<Session> {
  const client = getHonchoClient();
  return client.session(resolveSessionId(ctx), {
    metadata: ctx.guildId ? { guildId: ctx.guildId } : undefined,
  });
}

async function getSessionAndPeers(ctx: MessageContext) {
  return Promise.all([getSession(ctx), getPeer(ctx.userId), getBotPeer()]);
}

export async function addTurn({
  ctx,
  user,
  assistant,
}: {
  ctx: MessageContext;
  user: string;
  assistant: string;
}): Promise<void> {
  if (!user.trim() && !assistant.trim()) return;

  try {
    const [session, userPeer, botPeer] = await getSessionAndPeers(ctx);
    const metadata = toMetadata(ctx);

    const messages = [];
    if (user.trim()) messages.push(userPeer.message(user, { metadata }));
    if (assistant.trim()) messages.push(botPeer.message(assistant, { metadata }));

    if (messages.length > 0) {
      await session.addMessages(messages);
      logger.debug({ sessionId: session.id, count: messages.length }, 'Turn added');
    }
  } catch (error) {
    logger.error({ error, ctx }, 'addTurn failed');
    throw error;
  }
}

export async function getContext(
  ctx: MessageContext,
  options: ContextOptions = {},
): Promise<ContextResult> {
  try {
    const [session, userPeer, botPeer] = await getSessionAndPeers(ctx);

    const sessionContext = await session.context({
      tokens: options.tokens ?? 1024,
      peerTarget: userPeer.id,
      summary: true,
    });

    const messages = sessionContext.toOpenAI(botPeer.id);
    logger.debug({ sessionId: session.id, count: messages.length }, 'Context retrieved');

    return {
      messages: messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      userRepresentation: sessionContext.peerRepresentation ?? undefined,
    };
  } catch (error) {
    logger.error({ error, ctx }, 'getContext failed');
    return { messages: [] };
  }
}

export async function queryUser(
  userId: string,
  query: string,
  sessionId?: string,
): Promise<string | null> {
  try {
    const peer = await getPeer(userId);
    const response = await peer.chat(query, { session: sessionId });
    logger.debug({ userId, hasResponse: !!response }, 'queryUser');
    return response;
  } catch (error) {
    logger.error({ error, userId }, 'queryUser failed');
    return null;
  }
}

export async function getPeerCard(userId: string): Promise<string[] | null> {
  try {
    const peer = await getPeer(userId);
    const card = await peer.card();
    logger.debug({ userId, hasCard: !!card }, 'getPeerCard');
    return card;
  } catch (error) {
    logger.error({ error, userId }, 'getPeerCard failed');
    return null;
  }
}

export async function searchGuild(guildId: string, query: string): Promise<SearchResult[]> {
  try {
    const client = getHonchoClient();
    const messages = await client.search(query, {
      filters: { metadata: { guildId } },
      limit: 10,
    });

    logger.debug({ guildId, count: messages.length }, 'searchGuild');
    return messages.map((msg: Message) => ({
      sessionId: msg.sessionId,
      content: msg.content,
    }));
  } catch (error) {
    logger.error({ error, guildId }, 'searchGuild failed');
    return [];
  }
}
