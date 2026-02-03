import { createLogger } from '@/lib/logger';
import { getHonchoClient } from './client';
import type { ContextOptions, ContextResult, MessageContext } from './types';
import { getSessionId, toMetadata } from './utils';
import { ensureSessionPeers, getBotPeer, getUserPeer } from './peers';

const logger = createLogger('honcho');
const client = getHonchoClient();

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
