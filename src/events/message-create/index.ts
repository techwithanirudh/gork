import { keywords, messageThreshold } from '@/config';
import { ratelimit, redisKeys } from '@/lib/kv';
import { createLogger } from '@/lib/logger';
import { addTurn, buildMessageContext } from '@/lib/memory/honcho';
import { buildChatContext } from '@/utils/context';
import { logReply } from '@/utils/log';
import {
  checkMessageQuota,
  handleMessageCount,
  resetMessageCount,
} from '@/utils/message-rate-limiter';
import { getTrigger } from '@/utils/triggers';
import { Message, PermissionsBitField } from 'discord.js';
import { assessRelevance } from './utils/relevance';
import { generateResponse } from './utils/respond';

const logger = createLogger('events:message');

export const name = 'messageCreate';
export const once = false;

async function canReply(message: Message): Promise<boolean> {
  const { guild, author } = message;
  const isDM = !guild;
  const ctxId = isDM ? `dm:${author.id}` : guild.id;

  // rate limiting
  const { success } = await ratelimit.limit(redisKeys.channelCount(ctxId));
  if (!success) {
    logger.info(`[${ctxId}] Rate limit hit. Skipping reply.`);
    return false;
  }

  // permissions
  if (guild) {
    const botMember = guild.members.me;
    if (!botMember) return false;

    const channel = message.channel;
    if (!channel || !channel.isTextBased()) return false;

    if (!channel.isDMBased() && 'guild' in channel) {
      const permissions = botMember.permissionsIn(channel);
      const hasReadPermission = permissions.has(
        PermissionsBitField.Flags.ViewChannel,
      );
      const hasSendPermission = permissions.has(
        PermissionsBitField.Flags.SendMessages,
      );

      if (!hasReadPermission || !hasSendPermission) {
        logger.debug(
          { read: hasReadPermission, send: hasSendPermission },
          `[${guild.id}] Missing permissions in channel ${channel.id}`,
        );
        return false;
      }
    }
  }

  return true;
}

interface ToolCallResult {
  toolName: string;
  input?: Record<string, unknown>;
}

async function onSuccess(message: Message, toolCalls?: ToolCallResult[]) {
  // Extract the bot's response content from the reply tool call
  let botResponse = '';
  if (toolCalls) {
    const replyCall = toolCalls.find((tc) => tc.toolName === 'reply');
    if (replyCall?.input?.content) {
      const content = replyCall.input.content;
      botResponse = Array.isArray(content) ? content.join('\n') : String(content);
    }
  }

  const ctx = buildMessageContext(message);
  try {
    await addTurn(ctx, message.content, botResponse);
  } catch (error) {
    logger.error({ error }, 'Failed to add turn to Honcho');
  }
}

export async function execute(message: Message) {
  if (message.author.bot) return;
  if (message.author.id === message.client.user?.id) return;

  const { content, client, guild, author } = message;
  const isDM = !guild;
  const ctxId = isDM ? `dm:${author.id}` : guild.id;

  if (!(await canReply(message))) return;

  const botId = client.user?.id;
  const trigger = await getTrigger(message, keywords, botId);

  const { messages, hints } = await buildChatContext(message);

  if (trigger.type) {
    await resetMessageCount(ctxId);
    if ('sendTyping' in message.channel) {
      await message.channel.sendTyping();
    }

    logger.info(
      {
        message: `${author.username}: ${content}`,
      },
      `[${ctxId}] Triggered by ${trigger.type}`,
    );

    const result = await generateResponse(message, messages, hints);
    logReply(ctxId, author.username, result, 'trigger');
    if (result.success && result.toolCalls) {
      await onSuccess(message, result.toolCalls as ToolCallResult[]);
    }
    return;
  }

  const { count: idleCount, hasQuota } = await checkMessageQuota(ctxId);

  if (!hasQuota) {
    logger.debug(
      `[${ctxId}] Quota exhausted (${idleCount}/${messageThreshold})`,
    );
    return;
  }

  const { probability, reason } = await assessRelevance(
    message,
    messages,
    hints,
  );
  logger.info(
    { reason, probability, message: `${author.username}: ${content}` },
    `[${ctxId}] Relevance check`,
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
    await onSuccess(message, result.toolCalls as ToolCallResult[]);
  }
}
