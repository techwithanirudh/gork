import { createLogger } from '@/lib/logger';
import type { Peer, Session } from '@honcho-ai/sdk';
import { getHonchoClient } from './client';
import type { ContextOptions, ContextResult, MessageContext } from './types';
import { BOT_PEER_ID, getSessionId, resolvePeerId, toMetadata } from './utils';

const logger = createLogger('honcho');
const client = getHonchoClient();
const observedPeers = new Set<string>();

async function getBotPeer(): Promise<Peer> {
  return client.peer(BOT_PEER_ID, {
    configuration: { observeMe: false },
  });
}

async function getUserPeer(userId: string): Promise<Peer> {
  return client.peer(resolvePeerId(userId), {
    configuration: { observeMe: true },
  });
}

async function ensureSessionPeers(
  session: Session,
  peers: Array<{
    peer: Peer;
    configuration: { observeMe: boolean; observeOthers: boolean };
  }>,
) {
  const missing = peers.filter(
    ({ peer }) => !observedPeers.has(`${session.id}:${peer.id}`),
  );

  if (missing.length === 0) return;

  await session.addPeers(missing.map(({ peer }) => peer));

  await Promise.all(
    missing.map(({ peer, configuration }) =>
      session.setPeerConfiguration(peer, configuration),
    ),
  );

  for (const { peer } of missing) {
    observedPeers.add(`${session.id}:${peer.id}`);
  }
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
    const session = await client.session(getSessionId(ctx), {
      metadata: ctx.guildId ? { guildId: ctx.guildId } : undefined,
    });
    const [userPeer, botPeer] = await Promise.all([
      getUserPeer(ctx.userId),
      getBotPeer(),
    ]);

    await ensureSessionPeers(session, [
      {
        peer: userPeer,
        configuration: { observeMe: true, observeOthers: true },
      },
      {
        peer: botPeer,
        configuration: { observeMe: false, observeOthers: false },
      },
    ]);

    const metadata = toMetadata(ctx);
    const reasoningConfig = { reasoning: { enabled: true } };
    const messages = [];
    if (user.trim())
      messages.push(
        userPeer.message(user, { metadata, configuration: reasoningConfig }),
      );
    if (assistant.trim())
      messages.push(
        botPeer.message(assistant, { metadata, configuration: reasoningConfig }),
      );

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
    const session = await client.session(getSessionId(ctx), {
      metadata: ctx.guildId ? { guildId: ctx.guildId } : undefined,
    });
    const [userPeer, botPeer] = await Promise.all([
      getUserPeer(ctx.userId),
      getBotPeer(),
    ]);

    await ensureSessionPeers(session, [
      {
        peer: userPeer,
        configuration: { observeMe: true, observeOthers: true },
      },
      {
        peer: botPeer,
        configuration: { observeMe: false, observeOthers: false },
      },
    ]);

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
