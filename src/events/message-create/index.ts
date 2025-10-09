import { keywords, messageThreshold } from '@/config';
import { ratelimit, redisKeys } from '@/lib/kv';
import { saveChatMemory } from '@/lib/memory';
import { buildChatContext } from '@/utils/context';
import {
  checkMessageQuota,
  handleMessageCount,
  resetMessageCount,
} from '@/utils/message-rate-limiter';
import { Message } from 'discord.js';
import { assessRelevance } from './utils/relevance';
import { generateResponse } from './utils/respond';

import { createLogger } from '@/lib/logger';

import { logReply } from '@/utils/log';
import { getTrigger } from '@/utils/triggers';

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

async function onSuccess(message: Message) {
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

  const { messages, hints, memories } = await buildChatContext(message);

  if (trigger.type) {
    await resetMessageCount(ctxId);
    if ('sendTyping' in message.channel) {
      await message.channel.sendTyping();
    }

    logger.info(
      {
        message: `${author.username}: ${content}`,
      },
      `[${ctxId}] Triggered by ${trigger.type}`
    );

    const result = await generateResponse(message, messages, hints);
    logReply(ctxId, author.username, result, 'trigger');
    if (result.success && result.toolCalls) {
      await onSuccess(message);
    }
    return;
  }

  const { count: idleCount, hasQuota } = await checkMessageQuota(ctxId);

  if (!hasQuota) {
    logger.debug(
      `[${ctxId}] Quota exhausted (${idleCount}/${messageThreshold})`
    );
    return;
  }

  const { probability, reason } = await assessRelevance(
    message,
    messages,
    hints
  );
  logger.info(
    { reason, probability, message: `${author.username}: ${content}` },
    `[${ctxId}] Relevance check`
  );

  const willReply = probability > 0.5;
  await handleMessageCount(ctxId, willReply);

  if (!willReply) {
    logger.debug(`[${ctxId}] Low relevance — ignoring`);
    return;
  }

  if ('sendTyping' in message.channel) {
    await message.channel.sendTyping();
  }
  logger.info(`[${ctxId}] Replying (relevance: ${probability.toFixed(2)})`);
  const result = await generateResponse(message, messages, hints);
  logReply(ctxId, author.username, result, 'relevance');
  if (result.success && result.toolCalls) {
    await onSuccess(message);
  }
}
