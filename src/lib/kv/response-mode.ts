import { getRedis } from './client';
import { redisKeys } from './keys';

export type ResponseMode = 'ping' | 'relevance' | 'ping+keyword' | 'none';
export type ResponseModeScope = 'guild' | 'channel';

const DEFAULT_RESPONSE_MODE: ResponseMode = 'relevance';

export async function setResponseMode({
  scope,
  id,
  mode,
}: {
  scope: ResponseModeScope;
  id: string;
  mode: ResponseMode;
}): Promise<void> {
  const r = getRedis();
  if (!r) {
    return;
  }

  if (scope === 'guild') {
    await r.set(redisKeys.responseModeGuild(id), mode);
    return;
  }

  await r.set(redisKeys.responseModeChannel(id), mode);
}

export async function clearResponseMode({
  scope,
  id,
}: {
  scope: ResponseModeScope;
  id: string;
}): Promise<void> {
  const r = getRedis();
  if (!r) {
    return;
  }

  if (scope === 'guild') {
    await r.del(redisKeys.responseModeGuild(id));
    return;
  }

  await r.del(redisKeys.responseModeChannel(id));
}

export async function getStoredResponseMode({
  scope,
  id,
}: {
  scope: ResponseModeScope;
  id: string;
}): Promise<ResponseMode | null> {
  const r = getRedis();
  if (!r) {
    return null;
  }

  const mode =
    scope === 'guild'
      ? await r.get(redisKeys.responseModeGuild(id))
      : await r.get(redisKeys.responseModeChannel(id));

  if (
    mode === 'ping' ||
    mode === 'relevance' ||
    mode === 'ping+keyword' ||
    mode === 'none'
  ) {
    return mode;
  }

  return null;
}

export async function getResponseMode({
  guildId,
  channelId,
}: {
  guildId?: string;
  channelId?: string;
}): Promise<ResponseMode> {
  const r = getRedis();
  if (!r) {
    return DEFAULT_RESPONSE_MODE;
  }

  if (channelId) {
    const channelMode = await r.get(redisKeys.responseModeChannel(channelId));
    if (
      channelMode === 'ping' ||
      channelMode === 'relevance' ||
      channelMode === 'ping+keyword' ||
      channelMode === 'none'
    ) {
      return channelMode;
    }
  }

  if (guildId) {
    const guildMode = await r.get(redisKeys.responseModeGuild(guildId));
    if (
      guildMode === 'ping' ||
      guildMode === 'relevance' ||
      guildMode === 'ping+keyword' ||
      guildMode === 'none'
    ) {
      return guildMode;
    }
  }

  return DEFAULT_RESPONSE_MODE;
}
