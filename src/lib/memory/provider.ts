import { RedisProvider } from '@ai-sdk-tools/memory/redis';
import type { WorkingMemory, MemoryScope } from '@ai-sdk-tools/memory';
import { redis } from '@/lib/kv';
import { createLogger } from '@/lib/logger';

const logger = createLogger('memory:provider');

export type { WorkingMemory, MemoryScope };

let memoryProvider: RedisProvider | null = null;

export function getMemoryProvider(): RedisProvider {
  if (!memoryProvider) {
    memoryProvider = new RedisProvider(redis as any, {
      prefix: 'gork:memory:',
      messageTtl: 60 * 60 * 24 * 90,
    });
    logger.info('Memory provider initialized');
  }
  return memoryProvider;
}

export const WORKING_MEMORY_TEMPLATE = `# User Memory

## Facts
- (No facts recorded yet)

## Preferences  
- (No preferences recorded yet)

## Notes
- (No notes recorded yet)
`;

export async function getWorkingMemory(params: {
  guildId: string;
  userId: string;
}): Promise<WorkingMemory | null> {
  const provider = getMemoryProvider();
  try {
    return await provider.getWorkingMemory({
      chatId: `guild:${params.guildId}`,
      userId: params.userId,
      scope: 'chat',
    });
  } catch (error) {
    logger.error({ error, ...params }, 'Failed to get working memory');
    return null;
  }
}

export async function updateWorkingMemory(params: {
  guildId: string;
  userId: string;
  content: string;
}): Promise<void> {
  const provider = getMemoryProvider();
  try {
    await provider.updateWorkingMemory({
      chatId: `guild:${params.guildId}`,
      userId: params.userId,
      scope: 'chat',
      content: params.content,
    });
    logger.debug(
      { guildId: params.guildId, userId: params.userId },
      'Updated working memory',
    );
  } catch (error) {
    logger.error({ error, ...params }, 'Failed to update working memory');
    throw error;
  }
}

export function formatWorkingMemoryContent(
  memory: WorkingMemory | null,
): string {
  if (!memory?.content) {
    return WORKING_MEMORY_TEMPLATE;
  }
  return memory.content;
}

export function parseWorkingMemory(content: string): {
  facts: string[];
  preferences: string[];
  notes: string[];
} {
  const facts: string[] = [];
  const preferences: string[] = [];
  const notes: string[] = [];

  let currentSection: 'facts' | 'preferences' | 'notes' | null = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.toLowerCase().includes('## facts')) {
      currentSection = 'facts';
      continue;
    } else if (trimmed.toLowerCase().includes('## preferences')) {
      currentSection = 'preferences';
      continue;
    } else if (trimmed.toLowerCase().includes('## notes')) {
      currentSection = 'notes';
      continue;
    } else if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      currentSection = null;
      continue;
    }

    if (trimmed.startsWith('- ') && currentSection) {
      const item = trimmed.slice(2).trim();
      if (item.startsWith('(') && item.endsWith(')')) continue;
      if (!item) continue;

      switch (currentSection) {
        case 'facts':
          facts.push(item);
          break;
        case 'preferences':
          preferences.push(item);
          break;
        case 'notes':
          notes.push(item);
          break;
      }
    }
  }

  return { facts, preferences, notes };
}

export function addToWorkingMemory(
  currentContent: string,
  section: 'facts' | 'preferences' | 'notes',
  item: string,
): string {
  const lines = currentContent.split('\n');
  const sectionHeader = `## ${section.charAt(0).toUpperCase() + section.slice(1)}`;

  let inSection = false;
  let insertIndex = -1;
  let lastItemIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const trimmed = line.trim();

    if (trimmed.toLowerCase() === sectionHeader.toLowerCase()) {
      inSection = true;
      insertIndex = i + 1;
      continue;
    }

    if (inSection) {
      if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
        break;
      }
      if (trimmed.startsWith('- ')) {
        lastItemIndex = i;
        if (trimmed.includes('(No ') && trimmed.includes(' recorded yet)')) {
          lines[i] = `- ${item}`;
          return lines.join('\n');
        }
      }
    }
  }

  const insertAt = lastItemIndex !== -1 ? lastItemIndex + 1 : insertIndex;
  if (insertAt !== -1 && insertAt < lines.length) {
    lines.splice(insertAt, 0, `- ${item}`);
  } else if (insertAt !== -1) {
    lines.push(`- ${item}`);
  }

  return lines.join('\n');
}

export function removeFromWorkingMemory(
  currentContent: string,
  itemToRemove: string,
): string {
  const lines = currentContent.split('\n');
  const filteredLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('- ')) return true;
    const item = trimmed.slice(2).trim().toLowerCase();
    return !item.includes(itemToRemove.toLowerCase());
  });

  return filteredLines.join('\n');
}
