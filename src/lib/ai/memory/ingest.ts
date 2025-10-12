import { addMemory } from '@/lib/pinecone/queries';
import { getMessagesByChannel } from '@/lib/queries';
import type { PineconeMetadataInput } from '@/types';
import {
  ChannelType,
  type DMChannel,
  type GuildTextBasedChannel,
  type Message,
  type User,
} from 'discord.js';

type Importance = 'low' | 'med' | 'high';

interface StoreGateResult {
  store: boolean;
  importance: Importance;
  reason: string;
}

interface GuildInfo {
  id: string | null;
  name: string | null;
}

interface ChannelInfo {
  id: string;
  name: string;
  type: 'dm' | 'text' | 'voice' | 'thread' | 'unknown';
}

interface EntityRef {
  id: string;
  kind: 'user' | 'bot' | 'guild' | 'channel';
  handle?: string;
  display?: string;
  platform: 'discord';
}

type ChatMetadataPayload = Extract<PineconeMetadataInput, { type: 'chat' }>;

type ToolMetadataPayload = Extract<PineconeMetadataInput, { type: 'tool' }>;

const IMPORTANT_KEYWORDS =
  /\b(decide|decision|deadline|todo|plan|commit|ship|deploy|invite|token|schedule|meeting)\b/i;

export function sessionIdFromMessage(message: Message): string {
  if (!message.guild) {
    const botId = message.client.user?.id ?? 'bot';
    const [a, b] = [message.author.id, botId].sort();
    return `dm:${a}:${b}`;
  }

  return `guild:${message.guild.id}:${message.channel.id}`;
}

export function guildInfoFromMessage(message: Message): GuildInfo {
  return message.guild
    ? { id: message.guild.id, name: message.guild.name }
    : { id: null, name: null };
}

export function channelInfoFromMessage(message: Message): ChannelInfo {
  const type =
    message.channel.type === ChannelType.DM
      ? 'dm'
      : message.channel.type === ChannelType.GuildText
      ? 'text'
      : message.channel.type === ChannelType.GuildVoice
      ? 'voice'
      : message.channel.type === ChannelType.PublicThread ||
        message.channel.type === ChannelType.PrivateThread
      ? 'thread'
      : 'unknown';

  const name =
    message.channel.type === ChannelType.DM
      ? dmDisplayName(message.channel as DMChannel, message.author)
      : 'name' in message.channel
      ? (message.channel as GuildTextBasedChannel).name ?? ''
      : '';

  return {
    id: message.channel.id,
    name,
    type,
  };
}

function dmDisplayName(dm: DMChannel, author: User): string {
  const other = dm.recipient?.id === author.id ? dm.client.user : dm.recipient;
  return other?.username ?? 'Direct Message';
}

function participantsFromMessage(
  message: Message,
  channel: ChannelInfo
): EntityRef[] {
  const participants: EntityRef[] = [
    {
      id: message.author.id,
      kind: message.author.bot ? 'bot' : 'user',
      handle: message.author?.tag,
      display: message.author.username,
      platform: 'discord',
    },
  ];

  if (message.client.user) {
    participants.push({
      id: message.client.user.id,
      kind: 'bot',
      handle: message.client.user.tag,
      display: message.client.user.username,
      platform: 'discord',
    });
  }

  if (message.guild) {
    participants.push({
      id: message.guild.id,
      kind: 'guild',
      display: message.guild.name,
      platform: 'discord',
    });
  }

  participants.push({
    id: channel.id,
    kind: 'channel',
    display: channel.name || channel.type,
    platform: 'discord',
  });

  return participants;
}

function shouldStoreChat(context: string): StoreGateResult {
  const trimmed = context.trim();
  if (!trimmed) {
    return { store: false, importance: 'low', reason: 'Empty context' };
  }

  if (IMPORTANT_KEYWORDS.test(trimmed)) {
    return {
      store: true,
      importance: 'high',
      reason: 'Contains commitments or planning keywords',
    };
  }

  if (trimmed.length > 160 || trimmed.split('\n').length >= 4) {
    return {
      store: true,
      importance: 'med',
      reason: 'Meaningful multi-turn conversation',
    };
  }

  return {
    store: false,
    importance: 'low',
    reason: 'Small talk or trivial exchange',
  };
}

function formatTranscript(messages: Message[]): string {
  return messages
    .map((msg) => `${msg.author.username}: ${msg.content ?? ''}`.trim())
    .join('\n')
    .trim();
}

export async function saveChatMemory(message: Message, contextLimit = 5) {
  const recentMessages = await getMessagesByChannel({
    channel: message.channel,
    limit: contextLimit,
  });

  const transcript = formatTranscript(Array.from(recentMessages.values()));
  const gate = shouldStoreChat(transcript);

  if (!gate.store) {
    return null;
  }

  const now = Date.now();
  const sessionId = sessionIdFromMessage(message);
  const guild = guildInfoFromMessage(message);
  const channel = channelInfoFromMessage(message);

  const participants = participantsFromMessage(message, channel);

  const metadata: ChatMetadataPayload = {
    type: 'chat',
    createdAt: now,
    lastRetrievalTime: now,
    version: 2,
    sessionId,
    sessionType: message.guild ? 'guild' : 'dm',
    guild,
    channel,
    participants,
    context: transcript,
    importance: gate.importance,
    confidence: gate.importance === 'high' ? 0.9 : 0.82,
  };

  return addMemory(transcript, metadata);
}

export async function saveToolMemory(
  message: Message,
  toolName: string,
  result: unknown
) {
  const now = Date.now();
  const sessionId = sessionIdFromMessage(message);
  const guild = guildInfoFromMessage(message);
  const channel = channelInfoFromMessage(message);
  const participants = participantsFromMessage(message, channel);

  const payload = JSON.stringify({ toolName, result }, null, 2);

  const metadata: ToolMetadataPayload = {
    type: 'tool',
    createdAt: now,
    lastRetrievalTime: now,
    version: 2,
    sessionId,
    sessionType: message.guild ? 'guild' : 'dm',
    guild,
    channel,
    participants,
    name: toolName,
    response: result,
    importance: 'med',
    confidence: 0.85,
  };
  return addMemory(payload, metadata);
}
