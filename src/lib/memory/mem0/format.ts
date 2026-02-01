import type { MemoryResult } from './operations';

const MEMORY_SYSTEM_PROMPT =
  'These are the memories I have stored. ' +
  'Give more weightage to the question by users and try to answer that first. ' +
  'You have to modify your answer based on the memories I have provided. ' +
  'If the memories are irrelevant you can ignore them. ' +
  "Don't reply to this section of the prompt; it is only for your reference.";

export function formatMemories(memories: MemoryResult[]): string {
  if (!memories.length) return '';

  const entries = memories.map((m) => `Memory: ${m.content}`);
  return [`System Message: ${MEMORY_SYSTEM_PROMPT}`, ...entries].join('\n');
}
