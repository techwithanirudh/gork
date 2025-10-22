import { VoiceHandler } from './voice';

const handlers = new Map<string, VoiceHandler>();

export function getVoiceHandler(guildId: string): VoiceHandler | undefined {
  return handlers.get(guildId);
}

export function setVoiceHandler(
  guildId: string,
  handler: VoiceHandler
): void {
  handlers.set(guildId, handler);
}

export function deleteVoiceHandler(guildId: string): void {
  handlers.delete(guildId);
}
