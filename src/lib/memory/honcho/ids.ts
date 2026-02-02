import { ChannelType, SnowflakeUtil, type Message } from 'discord.js';
import type { MessageContext } from './types';

export function isSnowflake(id: string): boolean {
  try {
    SnowflakeUtil.deconstruct(id);
    return true;
  } catch {
    return false;
  }
}

export function resolvePeerId(userId: string): string {
  return `discord-${userId}`;
}

export function resolveSessionId(ctx: MessageContext): string {
  if (ctx.isDM) {
    const [a, b] = [ctx.userId, ctx.botId].sort();
    return `dm_${a}_${b}`;
  }

  const channelId = ctx.parentChannelId ?? ctx.channelId;
  return `g_${ctx.guildId}_c_${channelId}`;
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
