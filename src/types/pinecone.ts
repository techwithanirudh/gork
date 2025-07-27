export type PineconeMetadata = {
  text: string;
  hash: string;
  createdAt?: number;
  lastRetrievalTime?: number;
  type?: 'tool' | 'chat';
};
