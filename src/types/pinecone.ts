export type PineconeMetadata = {
    text: string;
    chunk: string;
    hash: string;
    created_at?: number;
    last_retrieval_time?: number;
    type?: 'tool' | 'chat';
}