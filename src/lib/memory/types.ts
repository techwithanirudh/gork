export type MemoryScope = 'chat' | 'user' | 'guild';

export interface WorkingMemoryConfig {
  enabled: boolean;
  scope: MemoryScope;
  template?: string;
}

export interface SemanticMemoryConfig {
  enabled: boolean;
  scoreThreshold?: number;
  defaultLimit?: number;
}

export interface MemoryConfig {
  workingMemory?: WorkingMemoryConfig;
  semanticMemory?: SemanticMemoryConfig;
}

export interface SemanticMemory {
  id: string;
  content: string;
  score: number;
  metadata: SemanticMemoryMetadata;
}

export interface SemanticMemoryMetadata {
  type: 'chat' | 'tool' | 'summary' | 'entity';
  createdAt: number;
  guildId?: string;
  guildName?: string;
  channelId: string;
  channelName?: string;
  channelType?: 'dm' | 'text' | 'voice' | 'thread';
  participantIds?: string[];
  sessionId?: string;
}

export interface SemanticSearchOptions {
  limit?: number;
  ageLimitDays?: number;
  ignoreRecent?: boolean;
  onlyTools?: boolean;
  filter?: Record<string, unknown>;
}

export interface MemoryContext {
  guildId?: string;
  guildName?: string;
  channelId: string;
  channelName?: string;
  userId: string;
  username: string;
}
