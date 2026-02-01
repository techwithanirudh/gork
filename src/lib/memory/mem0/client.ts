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
        provider: 'supabase',
        config: {
          supabaseUrl: env.SUPABASE_URL,
          supabaseKey: env.SUPABASE_SECRET,
          collectionName: 'mem0',
          tableName: "memories",
          embeddingModelDims: 1536
        },
      },
      embedder: {
        provider: 'openai',
        config: {
          apiKey: env.HACKCLUB_API_KEY,
          model: 'openai/text-embedding-3-small',
          url: 'https://ai.hackclub.com/proxy/v1',
        },
      },
      llm: {
        provider: 'openai',
        config: {
          apiKey: env.HACKCLUB_API_KEY,
          model: 'openai/gpt-5-mini',
          baseURL: 'https://ai.hackclub.com/proxy/v1'
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
