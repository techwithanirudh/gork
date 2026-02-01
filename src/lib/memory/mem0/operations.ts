import type { Message as DiscordMessage } from 'discord.js';
import { ChannelType } from 'discord.js';
import { createLogger } from '@/lib/logger';
import { getMemory, scopedUserId, sessionId } from './client';
import { getMessagesByChannel } from '@/lib/queries';

const logger = createLogger('memory:mem0');

export interface MemoryMetadata {
  type: 'chat' | 'tool';
  sessionId: string;
  sessionType: 'dm' | 'guild';
  guildId: string | null;
  guildName: string | null;
  channelId: string;
  channelName: string;
  channelType: string;
  participantIds: string[];
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
  guildId?: string;
  channelId?: string;
  sessionId?: string;
  sessionType?: 'dm' | 'guild';
  type?: 'chat' | 'tool';
  participantId?: string;
}

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

function collectParticipantIds(messages: DiscordMessage[], botId?: string) {
  const ids = new Set<string>();
  for (const msg of messages) {
    if (!msg.author.bot && msg.author.id !== botId) {
      ids.add(msg.author.id);
    }
  }
  return Array.from(ids);
}

function formatTranscript(messages: DiscordMessage[]): string {
  return messages
    .filter((msg) => msg.content?.trim())
    .map((msg) => `${msg.author.username}: ${msg.content?.trim() ?? ''}`.trim())
    .join('\n')
    .trim();
}

function buildMetadata(
  message: DiscordMessage,
  type: 'chat' | 'tool',
  participantIds: string[],
  toolName?: string,
): MemoryMetadata {
  const guildId = message.guild?.id ?? null;
  return {
    type,
    sessionId: sessionId(guildId, message.channel.id),
    sessionType: guildId ? 'guild' : 'dm',
    guildId,
    guildName: message.guild?.name ?? null,
    channelId: message.channel.id,
    channelName: getChannelName(message.channel),
    channelType: getChannelType(message.channel.type),
    participantIds,
    createdAt: Date.now(),
    toolName,
  };
}

async function ingest(messages: DiscordMessage[], message: DiscordMessage) {
  const transcript = formatTranscript(messages);
  if (!transcript) return null;

  const botId = message.client.user?.id;
  const participants = collectParticipantIds(messages, botId);
  const metadata = buildMetadata(message, 'chat', participants);
  const scopedId = scopedUserId(message.guild?.id ?? null, message.author.id);

  await getMemory().add([{ role: 'user', content: transcript }], {
    userId: scopedId,
    metadata,
  });

  logger.debug(
    { userId: scopedId, participantCount: participants.length },
    'Saved chat memory',
  );
}

export async function saveChatMemory(
  message: DiscordMessage,
  contextLimit = 5,
): Promise<void> {
  try {
    const recent = await getMessagesByChannel({
      channel: message.channel,
      limit: contextLimit,
    });

    const messages = Array.from(recent.values());
    if (!messages.length) return;

    await ingest(messages, message);
  } catch (error) {
    logger.error({ error }, 'Failed to save chat memory');
  }
}

export async function saveToolMemory(
  message: DiscordMessage,
  toolName: string,
  result: unknown,
): Promise<void> {
  try {
    const scopedId = scopedUserId(message.guild?.id ?? null, message.author.id);
    const participants = collectParticipantIds([message]);
    const metadata = buildMetadata(message, 'tool', participants, toolName);
    const payload = `Tool "${toolName}" result: ${JSON.stringify(result)}`;

    await getMemory().add([{ role: 'assistant', content: payload }], {
      userId: scopedId,
      metadata,
    });

    logger.debug({ userId: scopedId, toolName }, 'Saved tool memory');
  } catch (error) {
    logger.error({ error, toolName }, 'Failed to save tool memory');
  }
}

export async function searchMemories(
  query: string,
  userId: string,
  options: SearchOptions = {},
): Promise<MemoryResult[]> {
  const {
    limit = 5,
    guildId,
    channelId,
    sessionId: session,
    sessionType,
    type,
    participantId,
  } = options;

  const filters: Record<string, unknown> = {};
  if (guildId) filters.guildId = guildId;
  if (channelId) filters.channelId = channelId;
  if (session) filters.sessionId = session;
  if (sessionType) filters.sessionType = sessionType;
  if (type) filters.type = type;
  if (participantId) filters.participantIds = { in: [participantId] };

  try {
    const results = await getMemory().search(query, {
      userId,
      limit,
      filters: Object.keys(filters).length ? filters : undefined,
    });

    return (results.results ?? []).map((r) => ({
      id: r.id,
      content: r.memory,
      score: r.score ?? 0,
      metadata: r.metadata ?? {},
      createdAt: r.createdAt,
    }));
  } catch (error) {
    logger.error({ error, query }, 'Failed to search memories');
    return [];
  }
}

export async function getAllMemories(
  userId: string,
  limit = 50,
): Promise<MemoryResult[]> {
  try {
    const results = await getMemory().getAll({ userId, limit });

    return (results.results ?? []).map((r) => ({
      id: r.id,
      content: r.memory,
      score: r.score ?? 1,
      metadata: r.metadata ?? {},
      createdAt: r.createdAt,
    }));
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get memories');
    return [];
  }
}

export async function deleteMemory(memoryId: string): Promise<boolean> {
  try {
    await getMemory().delete(memoryId);
    return true;
  } catch (error) {
    logger.error({ error, memoryId }, 'Failed to delete memory');
    return false;
  }
}

export async function deleteAllMemories(userId: string): Promise<boolean> {
  try {
    await getMemory().deleteAll({ userId });
    return true;
  } catch (error) {
    logger.error({ error, userId }, 'Failed to delete memories');
    return false;
  }
}
