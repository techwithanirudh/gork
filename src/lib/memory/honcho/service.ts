import { createLogger } from '@/lib/logger';
import type { Message, Peer, Session } from '@honcho-ai/sdk';
import { getHonchoClient } from './client';
import type {
  ContextOptions,
  ContextResult,
  MessageContext,
  SearchResult,
} from './types';
import {
  BOT_PEER_ID,
  resolvePeerId,
  resolveSessionId,
  toMetadata,
} from './utils';

const logger = createLogger('honcho');

let cachedBotPeer: Peer | null = null;
const observedPeers = new Set<string>();

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

async function ensureObserved(
  session: Session,
  peer: Peer,
  configuration: { observeMe: boolean; observeOthers: boolean },
) {
  const key = `${session.id}:${peer.id}`;
  if (observedPeers.has(key)) return;
  await session.addPeers(peer);
  await session.setPeerConfiguration(peer, configuration);
  observedPeers.add(key);
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
    const client = getHonchoClient();
    const session = await client.session(resolveSessionId(ctx), {
      metadata: ctx.guildId ? { guildId: ctx.guildId } : undefined,
    });
    const [userPeer, botPeer] = await Promise.all([
      getPeer(ctx.userId),
      getBotPeer(),
    ]);

    await ensureObserved(session, userPeer, {
      observeMe: true,
      observeOthers: true,
    });
    await ensureObserved(session, botPeer, {
      observeMe: false,
      observeOthers: false,
    });
    const metadata = toMetadata(ctx);

    const messages = [];
    if (user.trim()) messages.push(userPeer.message(user, { metadata }));
    if (assistant.trim())
      messages.push(botPeer.message(assistant, { metadata }));

    if (messages.length > 0) {
      await session.addMessages(messages);
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
    const client = getHonchoClient();
    const session = await client.session(resolveSessionId(ctx), {
      metadata: ctx.guildId ? { guildId: ctx.guildId } : undefined,
    });
    const [userPeer, botPeer] = await Promise.all([
      getPeer(ctx.userId),
      getBotPeer(),
    ]);

    await ensureObserved(session, userPeer, {
      observeMe: true,
      observeOthers: true,
    });
    await ensureObserved(session, botPeer, {
      observeMe: false,
      observeOthers: false,
    });

    const sessionContext = await session.context({
      tokens: options.tokens ?? 2048,
      summary: true,
    });

    const messages = sessionContext.toOpenAI(botPeer.id);

    return {
      messages: messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      sessionSummary: sessionContext.summary?.content ?? undefined,
    };
  } catch (error) {
    logger.error({ error, ctx }, 'getContext failed');
    return { messages: [] };
  }
}

export async function getPeerCard(userId: string): Promise<string[] | null> {
  try {
    const peer = await getPeer(userId);
    const card = await peer.card();
    return card;
  } catch (error) {
    logger.error({ error, userId }, 'getPeerCard failed');
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

    return messages.map((msg: Message) => ({
      sessionId: msg.sessionId,
      content: msg.content,
    }));
  } catch (error) {
    logger.error({ error, guildId }, 'searchGuild failed');
    return [];
  }
}
