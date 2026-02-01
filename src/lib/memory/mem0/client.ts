import { Memory } from 'mem0ai/oss';
import { env } from '@/env';
import { createLogger } from '@/lib/logger';

const logger = createLogger('memory:mem0');

let instance: Memory | null = null;

export function getMemory(): Memory {
  if (!instance) {
    instance = new Memory({
      version: 'v1.1',
      vectorStore: {
        provider: 'pinecone',
        config: {
          apiKey: env.PINECONE_API_KEY,
          indexName: env.PINECONE_INDEX,
          namespace: 'mem0',
          embeddingModelDims: 1536,
        },
      },
      embedder: {
        provider: 'openai',
        config: {
          apiKey: env.OPENAI_API_KEY,
          model: 'text-embedding-3-small',
        },
      },
      llm: {
        provider: 'openai',
        config: {
          apiKey: env.OPENAI_API_KEY,
          model: 'gpt-4.1-nano-2025-04-14',
        },
      },
      disableHistory: true,
    });
    logger.info('mem0 initialized');
  }
  return instance;
}

export function scopedUserId(guildId: string | null, userId: string): string {
  return guildId ? `guild:${guildId}:${userId}` : `dm:${userId}`;
}
