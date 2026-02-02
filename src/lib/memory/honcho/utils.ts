import { ChannelType, SnowflakeUtil, type Message } from 'discord.js';
import type { MessageContext } from './types';

export const BOT_PEER_ID = 'u-gork';

export function isSnowflake(id: string): boolean {
  try {
    SnowflakeUtil.deconstruct(id);
    return true;
  } catch {
    return false;
  }
}

export function resolvePeerId(userId: string): string {
  return `u-${userId}`;
}

export function resolveSessionId(ctx: MessageContext): string {
  if (ctx.isDM) {
    const [a, b] = [ctx.userId, ctx.botId].sort();
    return `dm-${a}-${b}`;
  }
  const channelId = ctx.parentChannelId ?? ctx.channelId;
  return `g-${ctx.guildId}-c-${channelId}`;
}

export function toMetadata(ctx: MessageContext) {
  return {
    guildId: ctx.guildId,
    channelId: ctx.channelId,
    userId: ctx.userId,
    messageId: ctx.messageId,
  };
}

export function buildMessageContext(message: Message): MessageContext {
  const botId = message.client.user?.id ?? 'gork';
  const isDM = !message.guild;

  let parentChannelId: string | undefined;
  if (
    message.channel.type === ChannelType.PublicThread ||
    message.channel.type === ChannelType.PrivateThread
  ) {
    parentChannelId = message.channel.parentId ?? undefined;
  }

  return {
    userId: message.author.id,
    channelId: message.channel.id,
    guildId: message.guild?.id,
    parentChannelId,
    messageId: message.id,
    isDM,
    botId,
  };
}
