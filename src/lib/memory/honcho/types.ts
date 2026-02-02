import type { Message } from 'discord.js';

export interface MessageContext {
  userId: string;
  channelId: string;
  guildId?: string;
  parentChannelId?: string;
  isDM: boolean;
  botId: string;
}

export interface ContextResult {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  userRepresentation?: string;
}

export interface SearchResult {
  sessionId: string;
  content: string;
  relevance: number;
}

export type MessageRole = 'user' | 'assistant';

export interface IngestOptions {
  metadata?: Record<string, unknown>;
}

export interface ContextOptions {
  tokens?: number;
}

export type DiscordMessage = Message;
