import { messageThreshold } from '@/config';
import { redis, redisKeys } from '@/lib/kv';

async function getMessageCount(ctxId: string): Promise<number> {
  const key = redisKeys.messageCount(ctxId);
  const n = await redis.get(key);
  return n ? Number(n) : 0;
}

async function incrementMessageCount(ctxId: string): Promise<number> {
  const key = redisKeys.messageCount(ctxId);
  const results = await redis
    .multi()
    .incr(key)
    .expire(key, 3600)
    .exec();

  const n = Number(results?.[0] ?? 1);
  return n || 1;
}

export async function resetMessageCount(ctxId: string): Promise<void> {
  await redis.del(redisKeys.messageCount(ctxId));
}

export async function checkMessageQuota(ctxId: string): Promise<{
  count: number;
  hasQuota: boolean;
}> {
  const count = await getMessageCount(ctxId);
  return {
    count,
    hasQuota: count < messageThreshold,
  };
}

export async function handleMessageCount(
  ctxId: string,
  willReply: boolean
): Promise<number> {
  const key = redisKeys.messageCount(ctxId);

  if (willReply) {
    await redis.del(key);
    return 0;
  } else {
    return await incrementMessageCount(ctxId);
  }
}
