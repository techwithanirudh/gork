import { formatMemories } from '@/lib/ai/memory/format';
import type { PineconeMetadataOutput } from '@/types';

type MemoryWithMetadata = {
  metadata?: PineconeMetadataOutput | null;
};

export const memoriesPrompt = (memories: MemoryWithMetadata[]) => {
  const text = formatMemories(memories);
  if (!text) return '';
  return `<memories>\n${text}\n</memories>`;
};
