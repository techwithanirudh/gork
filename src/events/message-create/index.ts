import { keywords, messageThreshold } from '@/config';
import { ratelimit, redisKeys } from '@/lib/kv';
import { saveChatMemory } from '@/lib/memory';
import { buildChatContext } from '@/utils/context';
import {
  resetMessageCount,
  checkMessageQuota,
  handleMessageCount,
} from '@/utils/message-rate-limiter';
import { Message } from 'discord.js';
import { assessRelevance } from './utils/relevance';
import { generateResponse } from './utils/respond';

import { createLogger } from '@/lib/logger';

import { logReply } from '@/utils/log';
import { getTrigger } from '@/utils/triggers';
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
  await saveChatMemory(message, 5);
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
    logger.info(`[${ctxId}] Triggered by ${trigger.type}`, {
      message: `${author.username}: ${content}`
    });

    const { messages, hints, memories } = await buildChatContext(message);
    const result = await generateResponse(message, messages, hints, memories);
    logReply(ctxId, author.username, result, 'trigger');
    if (result.success && result.toolCalls) {
      await onSuccess(message, result.toolCalls);
    }
    return;
  }

  const { count: idleCount, hasQuota } = await checkMessageQuota(ctxId);

  if (!hasQuota) {
    logger.debug(`[${ctxId}] Quota exhausted (${idleCount}/${messageThreshold})`);
    return;
  }

  const { messages, hints, memories } = await buildChatContext(message);
  const { probability, reason } = await assessRelevance(
    message,
    messages,
    hints,
    memories
  );
  logger.info({ reason, probability, message: `${author.username}: ${content}` }, `[${ctxId}] Relevance check`);

  const willReply = probability > 0.5;
  await handleMessageCount(ctxId, willReply);

  if (!willReply) {
    logger.debug(`[${ctxId}] Low relevance — ignoring`);
    return;
  }

  logger.info(`[${ctxId}] Replying (relevance: ${probability.toFixed(2)})`, {
    message: `${author.username}: ${content}`
  });
  const result = await generateResponse(message, messages, hints, memories);
  logReply(ctxId, author.username, result, 'relevance');
  if (result.success && result.toolCalls) {
    await onSuccess(message, result.toolCalls);
  }
}
