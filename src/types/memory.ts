import type { PineconeMetadataOutput } from '@/types';

export interface MemoryRecord {
  id: string;
  score?: number;
  metadata: PineconeMetadataOutput;
}


