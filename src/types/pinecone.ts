export type PineconeMetadata = {
  text: string;
  hash: string;
  guild: string;
  channel: string;
  createdAt?: number;
  lastRetrievalTime?: number;
  type?: 'tool' | 'chat';
};
