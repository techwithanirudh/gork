import { keywords } from '@/config';
import { ratelimit, redisKeys } from '@/lib/kv';
import { addMemory } from '@/lib/pinecone/queries';
import { getMessagesByChannel } from '@/lib/queries';
import { buildChatContext } from '@/utils/context';
import {
  resetMessageCount,
  checkMessageQuota,
  handleMessageCount,
} from '@/utils/message-rate-limiter';
import { Message } from 'discord.js-selfbot-v13';
import { assessRelevance } from './utils/relevance';
import { generateResponse } from './utils/respond';

import { createLogger } from '@/lib/logger';

import { logIncoming, logReply, logTrigger } from '@/utils/log';
import { getTrigger } from '@/utils/triggers';
import type { ToolSet } from 'ai';
import type { ToolCallPart } from 'ai';

const logger = createLogger('events:message');

export const name = 'messageCreate';
export const once = false;

async function canReply(ctxId: string): Promise<boolean> {
  const { success } = await ratelimit.limit(redisKeys.channelCount(ctxId));
  if (!success) {
    logger.info(`[${ctxId}] Rate limit hit. Skipping reply.`);
  }
  return success;
}

async function onSuccess(message: Message, toolCalls: ToolCallPart[]) {
  const messages = await getMessagesByChannel({
    channel: message.channel,
    limit: 5,
  });

  const data = messages
    .map((msg) => `${msg.author.username}: ${msg.content}`)
    .join('\n');
  const metadata = {
    type: 'chat' as const,
    context: data,
    createdAt: Date.now(),
    lastRetrievalTime: Date.now(),
    guild: {
      id: message.guild?.id ?? null,
      name: message.guild?.name ?? null,
    },
    channel: {
      id: message.channel.id,
      name: message.channel.type === 'DM' ? 'DM' : message.channel.name ?? '',
    },
  };

  await addMemory(data, metadata);
}

export async function execute(message: Message) {
  if (message.author.bot) return;
  if (message.author.id === message.client.user?.id) return;

  const { content, client, guild, author } = message;
  const isDM = !guild;
  const ctxId = isDM ? `dm:${author.id}` : guild.id;

  if (!(await canReply(ctxId))) return;
  
  const botId = client.user?.id;
  const trigger = await getTrigger(message, keywords, botId);

  if (trigger.type) {
    await resetMessageCount(ctxId);

    logIncoming(ctxId, author.username, content);
    logTrigger(ctxId, trigger);

    const { messages, hints } = await buildChatContext(message);
    const result = await generateResponse(message, messages, hints);
    logReply(ctxId, author.username, result, 'explicit trigger');
    if (result.success && result.toolCalls) {
      await onSuccess(message, result.toolCalls);
    }
    return;
  }

  const { count: idleCount, hasQuota } = await checkMessageQuota(ctxId);
  logger.debug(`[${ctxId}] Idle counter: ${idleCount}`);

  if (!hasQuota) {
    logger.info(`[${ctxId}] Idle quota exhausted — staying silent`);
    return;
  }

  logIncoming(ctxId, author.username, content);

  const { messages, hints } = await buildChatContext(message);
  const { probability, reason } = await assessRelevance(
    message,
    messages,
    hints
  );
  logger.info({ reason, probability }, `[${ctxId}] Relevance check`);

  const willReply = probability > 0.5;
  await handleMessageCount(ctxId, willReply);

  if (!willReply) {
    logger.debug(`[${ctxId}] Low relevance — ignoring`);
    return;
  }

  logger.info(`[${ctxId}] Replying; idle counter reset`);
  const result = await generateResponse(message, messages, hints);
  logReply(ctxId, author.username, result, 'high relevance');
  if (result.success && result.toolCalls) {
    await onSuccess(message, result.toolCalls);
  }
}
