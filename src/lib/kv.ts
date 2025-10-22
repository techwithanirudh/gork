import { env } from '@/env';
import { createLogger } from '@/lib/logger';
import { createClient } from 'redis';

const PREFIX = env.NODE_ENV === 'development' ? 'beta:discord' : 'discord';
const WINDOW_SECONDS = 30;
const WINDOW_LIMIT = 30;

const logger = createLogger('redis');

export const redis = createClient({
  url: env.REDIS_URL,
});

redis.on('error', (error) => {
  logger.warn({ error }, 'Redis client error');
});

export const ratelimit = {
  async limit(
    key: string
  ): Promise<{ success: boolean; remaining?: number; reset?: number }> {
    const now = Date.now();
    const windowStart = now - WINDOW_SECONDS * 1000;
    const zsetKey = `${PREFIX}:rl:${key}`;
    try {
      const member = `${now}-${Math.random().toString(36).slice(2)}`;
      const results = await redis
        .multi()
        .zRemRangeByScore(zsetKey, 0, windowStart)
        .zAdd(zsetKey, { score: now, value: member })
        .zCard(zsetKey)
        .expire(zsetKey, WINDOW_SECONDS * 2)
        .exec();

      const count = Number(results?.[2] ?? 0);

      const success = count <= WINDOW_LIMIT;
      const remaining = Math.max(0, WINDOW_LIMIT - count);
      const reset = now + WINDOW_SECONDS * 1000;

      return { success, remaining, reset };
    } catch (error) {
      // Default to allowing the request so we do not block the bot entirely
      return { success: true };
    }
  },
};

export const redisKeys = {
  messageCount: (ctx: string) => `${PREFIX}:ctx:messageCount:${ctx}`,
  channelCount: (ctx: string) => `${PREFIX}:ctx:channelCount:${ctx}`,
  memorySessions: () => `${PREFIX}:memory:sessions`,
};
