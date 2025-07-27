import { type QueryResponse, type ScoredPineconeRecord } from "@pinecone-database/pinecone";
import { getIndex } from "./index";
import logger from "@/lib/logger";
import type { PineconeMetadata } from "@/types";

export const getMatchesFromEmbeddings = async (
  embeddings: number[],
  topK = 5,
  namespace = "default"
): Promise<ScoredPineconeRecord<PineconeMetadata>[]> => {
  try {
    const idx = await getIndex();
    const index = idx.namespace(namespace);

    const queryResult = await index.query({
      vector: embeddings,
      topK,
      includeMetadata: true,
    }) as QueryResponse<PineconeMetadata>;

    return queryResult.matches || [];
  } catch (error: unknown) {
    logger.error({ error }, "Error querying embeddings");
    throw error;
  }
};

export const upsertVectors = async (
  vectors: {
    id: string;
    values: number[];
    metadata: PineconeMetadata;
  }[],
  namespace = "default"
): Promise<void> => {
  try {
    const idx = await getIndex();
    const index = idx.namespace(namespace);
  
    await index.upsert(vectors);
  } catch (error: unknown) {
    logger.error({ error }, "Error upserting vectors");
    throw error;
  }
};

export const deleteVectors = async (
  ids: string[], 
  namespace = "default"
): Promise<void> => {
  try {
    const idx = await getIndex();
    const index = idx.namespace(namespace);

    await index.deleteMany(ids);
  } catch (error: unknown) {
    logger.error({ error }, "Error deleting vectors");
    throw error;
  }
};
