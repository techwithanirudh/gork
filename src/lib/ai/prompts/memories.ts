import type { PineconeMetadataOutput } from '@/types';
import type { ScoredPineconeRecord } from '@pinecone-database/pinecone';
import { formatMemories } from '@/lib/ai/memory/text';

export const memoriesPrompt = (
  memories: ScoredPineconeRecord<PineconeMetadataOutput>[]
) => {
  const text = formatMemories(memories);
  if (!text) return '';
  return `\n\n<memories>\n${text}\n</memories>`;
};


