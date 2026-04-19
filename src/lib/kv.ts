import { createClient, type RedisClientType } from 'redis';
import { env } from '@/env';
import { createLogger } from '@/lib/logger';

const PREFIX = env.NODE_ENV === 'development' ? 'beta:discord' : 'discord';
const WINDOW_SECONDS = 30;
const WINDOW_LIMIT = 30;

const logger = createLogger('redis');

export const redis: RedisClientType | null = env.REDIS_URL
  ? createClient({
      url: env.REDIS_URL,
      socket: {
        connectTimeout: 3000,
        keepAlive: true,
        reconnectStrategy() {
          return false;
        },
      },
      pingInterval: 60_000,
    })
  : null;

redis?.on('error', (error) => {
  if (error instanceof Error) {
    logger.warn({ err: error }, 'Redis client error');
  } else {
    logger.warn({ error }, 'Redis client error');
  }
});

redis?.on('reconnecting', (delay) => {
  logger.debug({ delay }, 'Redis reconnecting');
});

redis?.on('ready', () => {
  logger.debug('Redis connection ready');
});

export const ratelimit = {
  async limit(
    key: string
  ): Promise<{ success: boolean; remaining?: number; reset?: number }> {
    if (!redis) {
      return { success: true };
    }

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
      logger.warn({ error, key }, 'Redis ratelimit failed; allowing request');
      return { success: true };
    }
  },
};

export const redisKeys = {
  messageCount: (ctx: string) => `${PREFIX}:ctx:messageCount:${ctx}`,
  channelCount: (ctx: string) => `${PREFIX}:ctx:channelCount:${ctx}`,
  memorySessions: () => `${PREFIX}:memory:sessions`,
};
