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
    } else if (trimmed.toLowerCase().includes('## preferences')) {
      currentSection = 'preferences';
    } else if (trimmed.toLowerCase().includes('## notes')) {
      currentSection = 'notes';
    } else if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      currentSection = null;
    } else if (trimmed.startsWith('- ') && currentSection) {
      const item = trimmed.slice(2).trim();
      if (item.startsWith('(') && item.endsWith(')')) continue;
      if (!item) continue;

      if (currentSection === 'facts') facts.push(item);
      else if (currentSection === 'preferences') preferences.push(item);
      else if (currentSection === 'notes') notes.push(item);
    }
  }

  return { facts, preferences, notes };
}

function buildWorkingMemory(parsed: {
  facts: string[];
  preferences: string[];
  notes: string[];
}): string {
  const lines = ['# User Memory', ''];

  lines.push('## Facts');
  if (parsed.facts.length === 0) {
    lines.push('- (No facts recorded yet)');
  } else {
    for (const fact of parsed.facts) {
      lines.push(`- ${fact}`);
    }
  }

  lines.push('');
  lines.push('## Preferences');
  if (parsed.preferences.length === 0) {
    lines.push('- (No preferences recorded yet)');
  } else {
    for (const pref of parsed.preferences) {
      lines.push(`- ${pref}`);
    }
  }

  lines.push('');
  lines.push('## Notes');
  if (parsed.notes.length === 0) {
    lines.push('- (No notes recorded yet)');
  } else {
    for (const note of parsed.notes) {
      lines.push(`- ${note}`);
    }
  }

  return lines.join('\n');
}

function isDuplicate(existing: string[], newItem: string): boolean {
  const newLower = newItem.toLowerCase();
  return existing.some((item) => {
    const itemLower = item.toLowerCase();
    return (
      itemLower === newLower ||
      itemLower.includes(newLower) ||
      newLower.includes(itemLower)
    );
  });
}

export async function addToWorkingMemory(params: {
  guildId: string;
  userId: string;
  section: 'facts' | 'preferences' | 'notes';
  item: string;
}): Promise<{ added: boolean; reason?: string }> {
  const existing = await getWorkingMemory({
    guildId: params.guildId,
    userId: params.userId,
  });

  const content = existing?.content ?? WORKING_MEMORY_TEMPLATE;
  const parsed = parseWorkingMemory(content);
  const targetArray = parsed[params.section];

  if (isDuplicate(targetArray, params.item)) {
    return { added: false, reason: 'Similar item already exists' };
  }

  targetArray.push(params.item);
  const newContent = buildWorkingMemory(parsed);

  await updateWorkingMemory({
    guildId: params.guildId,
    userId: params.userId,
    content: newContent,
  });

  return { added: true };
}

export async function removeFromWorkingMemory(params: {
  guildId: string;
  userId: string;
  item: string;
}): Promise<{ removed: boolean; reason?: string }> {
  const existing = await getWorkingMemory({
    guildId: params.guildId,
    userId: params.userId,
  });

  if (!existing?.content) {
    return { removed: false, reason: 'No memory exists for this user' };
  }

  const parsed = parseWorkingMemory(existing.content);
  const itemLower = params.item.toLowerCase();
  let found = false;

  for (const section of ['facts', 'preferences', 'notes'] as const) {
    const original = parsed[section].length;
    parsed[section] = parsed[section].filter(
      (i) => !i.toLowerCase().includes(itemLower),
    );
    if (parsed[section].length < original) found = true;
  }

  if (!found) {
    return { removed: false, reason: 'Item not found in memory' };
  }

  const newContent = buildWorkingMemory(parsed);
  await updateWorkingMemory({
    guildId: params.guildId,
    userId: params.userId,
    content: newContent,
  });

  return { removed: true };
}
