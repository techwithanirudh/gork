import { saveToolMemory } from '@/lib/memory';
import type { Message } from 'discord.js';

export async function logToolResult(
  message: Message,
  toolName: string,
  result: unknown,
): Promise<void> {
  await saveToolMemory(message, toolName, result);
}
