import type { MemoryResult } from './operations';

export function formatMemories(memories: MemoryResult[]): string {
  if (!memories.length) return '';

  const entries = memories.map((m) => {
    const when = m.createdAt ? new Date(m.createdAt).toISOString() : 'unknown';
    const meta = m.metadata ?? {};
    const where = `${meta.guildName ?? 'Unknown'} > ${meta.channelName ?? 'Unknown'}`;
    const type = meta.type ?? 'memory';
    return `- type: ${type}\n    when: ${when}\n    where: ${where}\n    content: ${m.content}\n    relevance: ${(m.score * 100).toFixed(0)}%`;
  });

  return ['[memory]', ...entries, '[/memory]'].join('\n');
}

export function formatAllMemories(memories: MemoryResult[]): string {
  if (!memories.length) {
    return '# User Memory\n\nNo memories stored yet.';
  }

  const lines = ['# User Memory', ''];
  for (const m of memories) {
    lines.push(`- ${m.content}`);
  }
  return lines.join('\n');
}

export function formatWorkingMemory(memories: MemoryResult[] | null): string {
  if (!memories?.length) return '';

  return [
    '<working_memory>',
    ...memories.map((m) => `- ${m.content}`),
    '</working_memory>',
  ].join('\n');
}
