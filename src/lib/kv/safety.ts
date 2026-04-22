import { getRedis } from './client';
import { redisKeys } from './keys';

export type SafetyMode = 'unfiltered' | 'safe';
export type SafetyScope = 'guild' | 'channel';

const DEFAULT_SAFETY_MODE: SafetyMode = 'unfiltered';

function isSafetyMode(value: string | null): value is SafetyMode {
  return value === 'unfiltered' || value === 'safe';
}

export async function setSafetyMode({
  scope,
  id,
  mode,
}: {
  scope: SafetyScope;
  id: string;
  mode: SafetyMode;
}): Promise<void> {
  const r = getRedis();
  if (!r) {
    return;
  }
  const key =
    scope === 'guild' ? redisKeys.safetyGuild(id) : redisKeys.safetyChannel(id);
  await r.set(key, mode);
}

export async function clearSafetyMode({
  scope,
  id,
}: {
  scope: SafetyScope;
  id: string;
}): Promise<void> {
  const r = getRedis();
  if (!r) {
    return;
  }
  const key =
    scope === 'guild' ? redisKeys.safetyGuild(id) : redisKeys.safetyChannel(id);
  await r.del(key);
}

export async function getStoredSafetyMode({
  scope,
  id,
}: {
  scope: SafetyScope;
  id: string;
}): Promise<SafetyMode | null> {
  const r = getRedis();
  if (!r) {
    return null;
  }
  const key =
    scope === 'guild' ? redisKeys.safetyGuild(id) : redisKeys.safetyChannel(id);
  const value = await r.get(key);
  return isSafetyMode(value) ? value : null;
}

export async function getSafetyMode({
  guildId,
  channelId,
}: {
  guildId?: string;
  channelId?: string;
}): Promise<SafetyMode> {
  const r = getRedis();
  if (!r) {
    return DEFAULT_SAFETY_MODE;
  }

  if (channelId) {
    const value = await r.get(redisKeys.safetyChannel(channelId));
    if (isSafetyMode(value)) {
      return value;
    }
  }

  if (guildId) {
    const value = await r.get(redisKeys.safetyGuild(guildId));
    if (isSafetyMode(value)) {
      return value;
    }
  }

  return DEFAULT_SAFETY_MODE;
}
