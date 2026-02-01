import type { Message as DiscordMessage } from 'discord.js';
import { ChannelType } from 'discord.js';
import { createLogger } from '@/lib/logger';
import { getMemory, scopedUserId } from './client';

const logger = createLogger('memory:mem0');

export interface MemoryMetadata {
  version: number;
  type: 'chat' | 'tool';
  lastRetrievalTime?: number;
  sessionId: string;
  sessionType: 'dm' | 'guild';
  guildId: string | null;
  guildName: string | null;
  channelId: string;
  channelName: string;
  channelType: string;
  participantIds: string[];
  entityIds?: string[];
  createdAt: number;
  toolName?: string;
}

export interface MemoryResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
  createdAt?: string;
}

export interface SearchOptions {
  limit?: number;
  filters?: MemoryFilter;
}

export type MemoryFilter = Record<string, unknown>;

function getChannelType(type: ChannelType): string {
  switch (type) {
    case ChannelType.DM:
    case ChannelType.GroupDM:
      return 'dm';
    case ChannelType.GuildText:
    case ChannelType.GuildAnnouncement:
      return 'text';
    case ChannelType.GuildVoice:
    case ChannelType.GuildStageVoice:
      return 'voice';
    case ChannelType.PublicThread:
    case ChannelType.PrivateThread:
    case ChannelType.AnnouncementThread:
      return 'thread';
    default:
      return 'unknown';
  }
}

function getChannelName(channel: DiscordMessage['channel']): string {
  return 'name' in channel && channel.name ? channel.name : 'direct-message';
}

function sessionIdFromMessage(message: DiscordMessage): string {
  if (!message.guild) {
    const botId = message.client.user?.id;
    if (botId) {
      const [a, b] = [message.author.id, botId].sort();
      return `dm:${a}:${b}`;
    }
    return `dm:${message.channel.id}`;
  }

  return `guild:${message.guild.id}:${message.channel.id}`;
}

function collectParticipantIds(message: DiscordMessage) {
  const ids = new Set<string>();
  if (!message.author.bot) {
    ids.add(message.author.id);
  }
  for (const [userId, user] of message.mentions.users) {
    if (!user.bot) {
      ids.add(userId);
    }
  }
  return Array.from(ids);
}

function buildMetadata(
  message: DiscordMessage,
  type: 'chat' | 'tool',
  participantIds: string[],
  toolName?: string,
): MemoryMetadata {
  const guildId = message.guild?.id ?? null;
  const now = message.createdTimestamp || Date.now();
  return {
    version: 2,
    type,
    lastRetrievalTime: now,
    sessionId: sessionIdFromMessage(message),
    sessionType: guildId ? 'guild' : 'dm',
    guildId,
    guildName: message.guild?.name ?? null,
    channelId: message.channel.id,
    channelName: getChannelName(message.channel),
    channelType: getChannelType(message.channel.type),
    participantIds,
    entityIds: participantIds,
    createdAt: now,
    toolName,
  };
}

export async function addTurnMemory(
  message: DiscordMessage,
  userContent: string,
  assistantContent: string,
): Promise<void> {
  try {
    const memory = await getMemory();
    if (!memory) return;
    const userText = userContent?.trim();
    const assistantText = assistantContent?.trim();
    if (!userText || !assistantText) return;

    const participants = collectParticipantIds(message);
    const metadata = buildMetadata(message, 'chat', participants);
    const userId = scopedUserId(message.guild?.id ?? null, message.author.id);

    await memory.add(
      [
        { role: 'user', content: userText },
        { role: 'assistant', content: assistantText },
      ],
      { userId, metadata },
    );

    logger.debug({ userId }, 'Saved mem0 chat memory');
  } catch (error) {
    logger.error({ error }, 'Failed to save chat memory');
  }
}

export async function searchMemories(
  query: string,
  userId: string,
  options: SearchOptions = {},
): Promise<MemoryResult[]> {
  const { limit = 5, filters } = options;

  try {
    const memory = await getMemory();
    if (!memory) return [];
    const payload = filters ? { userId, limit, filters } : { userId, limit };
    const results = await memory.search(query, payload);

    return (results.results ?? []).map((result) => ({
      id: result.id,
      content: result.memory,
      score: result.score ?? 0,
      metadata: result.metadata ?? {},
      createdAt: result.createdAt,
    }));
  } catch (error) {
    logger.error({ error, query }, 'Failed to search memories');
    return [];
  }
}

export async function deleteMemory(memoryId: string): Promise<boolean> {
  try {
    const memory = await getMemory();
    if (!memory) return false;
    await memory.delete(memoryId);
    return true;
  } catch (error) {
    logger.error({ error, memoryId }, 'Failed to delete memory');
    return false;
  }
}
