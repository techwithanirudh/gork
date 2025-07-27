export type PineconeMetadata = {
  text: string;
  guild: string;
  channel: string;
  createdAt?: number;
  lastRetrievalTime?: number;
  type?: 'tool' | 'chat';
};
