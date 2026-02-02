export interface MessageContext {
  userId: string;
  channelId: string;
  guildId?: string;
  parentChannelId?: string;
  messageId?: string;
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
}

export interface ContextOptions {
  tokens?: number;
}
