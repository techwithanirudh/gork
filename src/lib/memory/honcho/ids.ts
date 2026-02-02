import { ChannelType, type Message } from 'discord.js';
import type { MessageContext } from './types';

export function resolvePeerId(userId: string): string {
  return `discord:${userId}`;
}

export function resolveSessionId(ctx: MessageContext): string {
  if (ctx.isDM) {
    const [a, b] = [ctx.userId, ctx.botId].sort();
    return `dm:${a}:${b}`;
  }

  const channelId = ctx.parentChannelId ?? ctx.channelId;
  return `guild:${ctx.guildId}:chan:${channelId}`;
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
    isDM,
    botId,
  };
}
