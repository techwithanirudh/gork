import type { PineconeMetadataOutput } from '@/types';
import type { ScoredPineconeRecord } from '@pinecone-database/pinecone';

export const memoryPrompt = (
  memories: ScoredPineconeRecord<PineconeMetadataOutput>[]
) => `\
<memory>
As Gork, you can't remember everything across all the servers, that's what long-term memory is for. 
So you are given the following memories to help you answer the question.

${memories.map((memory) => JSON.stringify(memory)).join('\n\n')}
</memory>`;
