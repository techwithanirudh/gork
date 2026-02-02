import { getHonchoClient } from './client';
import { resolvePeerId, resolveSessionId } from './ids';
import type {
  MessageContext,
  ContextResult,
  SearchResult,
  MessageRole,
  ContextOptions,
} from './types';
import { createLogger } from '@/lib/logger';
import type { Message, Peer, Session } from '@honcho-ai/sdk';

const logger = createLogger('honcho:service');

const BOT_PEER_ID = 'gork';

let cachedBotPeer: Peer | null = null;

async function getBotPeer(): Promise<Peer> {
  if (cachedBotPeer) return cachedBotPeer;

  const client = getHonchoClient();
  const peer = await client.peer(BOT_PEER_ID, {
    configuration: { observeMe: false },
  });
  cachedBotPeer = peer;
  logger.debug({ peerId: BOT_PEER_ID }, 'Bot peer initialized');
  return peer;
}

async function getOrCreatePeer(userId: string): Promise<Peer> {
  const client = getHonchoClient();
  const peerId = resolvePeerId(userId);
  return client.peer(peerId, {
    configuration: { observeMe: true },
  });
}

async function getOrCreateSession(ctx: MessageContext): Promise<Session> {
  const client = getHonchoClient();
  const sessionId = resolveSessionId(ctx);
  return client.session(sessionId);
}

export async function ingestMessage(
  ctx: MessageContext,
  content: string,
  role: MessageRole,
): Promise<void> {
  if (!content.trim()) {
    logger.debug({ ctx, role }, 'Skipping empty message');
    return;
  }

  try {
    const session = await getOrCreateSession(ctx);
    const peer = role === 'user' ? await getOrCreatePeer(ctx.userId) : await getBotPeer();

    const messageInput = peer.message(content);
    await session.addMessages([messageInput]);

    logger.debug(
      {
        sessionId: session.id,
        peerId: peer.id,
        role,
        contentLength: content.length,
      },
      'Message ingested',
    );
  } catch (error) {
    logger.error({ error, ctx, role }, 'Failed to ingest message');
    throw error;
  }
}

export async function ingestExchange(
  ctx: MessageContext,
  userContent: string,
  assistantContent: string,
): Promise<void> {
  if (!userContent.trim() && !assistantContent.trim()) {
    logger.debug({ ctx }, 'Skipping empty exchange');
    return;
  }

  try {
    const session = await getOrCreateSession(ctx);
    const userPeer = await getOrCreatePeer(ctx.userId);
    const botPeer = await getBotPeer();

    const messages = [];
    if (userContent.trim()) {
      messages.push(userPeer.message(userContent));
    }
    if (assistantContent.trim()) {
      messages.push(botPeer.message(assistantContent));
    }

    if (messages.length > 0) {
      await session.addMessages(messages);
      logger.debug(
        {
          sessionId: session.id,
          messageCount: messages.length,
        },
        'Exchange ingested',
      );
    }
  } catch (error) {
    logger.error({ error, ctx }, 'Failed to ingest exchange');
    throw error;
  }
}

export async function getContext(
  ctx: MessageContext,
  options: ContextOptions = {},
): Promise<ContextResult> {
  const tokens = options.tokens ?? 1024;

  try {
    const session = await getOrCreateSession(ctx);
    const userPeer = await getOrCreatePeer(ctx.userId);
    const botPeer = await getBotPeer();

    const sessionContext = await session.context({
      tokens,
      peerTarget: userPeer.id,
      summary: true,
    });

    const messages = sessionContext.toOpenAI(botPeer.id);

    logger.debug(
      {
        sessionId: session.id,
        messageCount: messages.length,
        hasRepresentation: !!sessionContext.peerRepresentation,
      },
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
    logger.error({ error, ctx, tokens }, 'Failed to get context');
    return { messages: [] };
  }
}

export async function queryUser(
  userId: string,
  query: string,
  sessionId?: string,
): Promise<string | null> {
  try {
    const peer = await getOrCreatePeer(userId);

    const response = await peer.chat(query, {
      session: sessionId,
    });

    logger.debug(
      {
        userId,
        query,
        hasResponse: !!response,
      },
      'User query completed',
    );

    return response;
  } catch (error) {
    logger.error({ error, userId, query }, 'Failed to query user');
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
      filters: {
        'session.id': { $startsWith: `guild:${guildId}:` },
      },
      limit: 10,
    });

    const results: SearchResult[] = messages.map((msg: Message) => ({
      sessionId: msg.sessionId,
      content: msg.content,
      relevance: 1.0,
    }));

    logger.debug(
      {
        guildId,
        query,
        resultCount: results.length,
      },
      'Guild search completed',
    );

    return results;
  } catch (error) {
    logger.error({ error, guildId, query }, 'Failed to search guild');
    return [];
  }
}
