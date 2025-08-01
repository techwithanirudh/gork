import { messageThreshold } from '@/config';
import { redis, redisKeys } from '@/lib/kv';

export async function getUnprompted(ctxId: string): Promise<number> {
  const key = redisKeys.messageCount(ctxId);
  const n = await redis.get(key);
  return n ? Number(n) : 0;
}

export async function incrementUnprompted(ctxId: string): Promise<number> {
  const key = redisKeys.messageCount(ctxId);
  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, 3600);
  
  const results = await pipeline.exec();
  const n = (results?.[0] as [any, number])?.[1];
  return n || 1;
}

export async function clearUnprompted(ctxId: string): Promise<void> {
  await redis.del(redisKeys.messageCount(ctxId));
}

export async function getUnpromptedWithQuotaCheck(ctxId: string): Promise<{
  count: number;
  hasQuota: boolean;
}> {
  const count = await getUnprompted(ctxId);
  return {
    count,
    hasQuota: count < messageThreshold
  };
}
