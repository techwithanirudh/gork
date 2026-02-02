import { createLogger } from '@/lib/logger';
import type { Message, Peer, Session } from '@honcho-ai/sdk';
import { getHonchoClient } from './client';
import { resolvePeerId, resolveSessionId } from './ids';
import type {
  ContextOptions,
  ContextResult,
  MessageContext,
  SearchResult,
} from './types';

const logger = createLogger('honcho');

const BOT_PEER_ID = 'gork';
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

  const metadata = {
    guildId: ctx.guildId,
    channelId: ctx.channelId,
    userId: ctx.userId,
    messageId: ctx.messageId,
  };

  try {
    const [session, userPeer, botPeer] = await Promise.all([
      getSession(ctx),
      getPeer(ctx.userId),
      getBotPeer(),
    ]);

    const messages = [];
    if (user.trim()) messages.push(userPeer.message(user, { metadata }));
    if (assistant.trim()) messages.push(botPeer.message(assistant, { metadata }));

    if (messages.length > 0) {
      await session.addMessages(messages);
      logger.debug({ sessionId: session.id, count: messages.length }, 'Turn added');
    }
  } catch (error) {
    logger.error({ error, ctx }, 'Failed to add turn');
    throw error;
  }
}

export async function getContext(
  ctx: MessageContext,
  options: ContextOptions = {},
): Promise<ContextResult> {
  const tokens = options.tokens ?? 1024;

  try {
    const [session, userPeer, botPeer] = await Promise.all([
      getSession(ctx),
      getPeer(ctx.userId),
      getBotPeer(),
    ]);

    const sessionContext = await session.context({
      tokens,
      peerTarget: userPeer.id,
      summary: true,
    });

    const messages = sessionContext.toOpenAI(botPeer.id);

    logger.debug(
      { sessionId: session.id, count: messages.length, hasRep: !!sessionContext.peerRepresentation },
      'Context retrieved',
    );

    return {
      messages: messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      userRepresentation: sessionContext.peerRepresentation ?? undefined,
    };
  } catch (error) {
    logger.error({ error, ctx }, 'Failed to get context');
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
    logger.debug({ userId, query, hasResponse: !!response }, 'User queried');
    return response;
  } catch (error) {
    logger.error({ error, userId, query }, 'Failed to query user');
    return null;
  }
}

export async function getPeerCard(userId: string): Promise<string[] | null> {
  try {
    const peer = await getPeer(userId);
    const card = await peer.card();
    logger.debug({ userId, hasCard: !!card }, 'Peer card retrieved');
    return card;
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get peer card');
    return null;
  }
}

export async function searchGuild(
  guildId: string,
  query: string,
): Promise<SearchResult[]> {
  try {
    const client = getHonchoClient();
    const messages = await client.search(query, {
      filters: { metadata: { guildId } },
      limit: 10,
    });

    const results = messages.map((msg: Message) => ({
      sessionId: msg.sessionId,
      content: msg.content,
    }));

    logger.debug({ guildId, query, count: results.length }, 'Guild search');
    return results;
  } catch (error) {
    logger.error({ error, guildId, query }, 'Guild search failed');
    return [];
  }
}
