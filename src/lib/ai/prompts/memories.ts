import { formatMemories } from '@/lib/ai/memory/text';
import type { PineconeMetadataOutput } from '@/types';
import type { ScoredPineconeRecord } from '@pinecone-database/pinecone';

export const memoriesPrompt = (
  memories: ScoredPineconeRecord<PineconeMetadataOutput>[]
) => {
  const text = formatMemories(memories);
  if (!text) return '';
  return `<memories>\n${text}\n</memories>`;
};
