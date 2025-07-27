import { type QueryResponse, type ScoredPineconeRecord } from "@pinecone-database/pinecone";
import { getIndex } from "./index";
import logger from "@/lib/logger";
import type { PineconeMetadata } from "@/types";
import { MD5 } from "bun";

export interface MemorySearchOptions {
  namespace?: string;
  topK?: number;
}

export const addMemory = async (
  text: string,
  denseEmbeddings: number[],
  namespace = "default"
): Promise<string> => {
  try {
    const hash = new MD5().update(text).digest("hex");

    const metadata: PineconeMetadata = {
      text,
      chunk: text,
      hash
    };

    const idx = await getIndex();
    const index = idx.namespace(namespace);
    
    await index.upsert([{
      id: hash,
      values: denseEmbeddings,
      metadata,
    }]);

    logger.info({ hash }, "Added memory to Pinecone");
    return hash;
  } catch (error: unknown) {
    logger.error({ error }, "Error adding memory");
    throw error;
  }
};

export const searchMemories = async (
  denseEmbeddings: number[],
  options: MemorySearchOptions = {}
): Promise<ScoredPineconeRecord<PineconeMetadata>[]> => {
  const {
    namespace = "default",
    topK = 5,
  } = options;

  try {
    const idx = await getIndex();
    const index = idx.namespace(namespace);
    
    const queryResult = await index.query({
      vector: denseEmbeddings,
      topK,
      includeMetadata: true,
    }) as QueryResponse<PineconeMetadata>;

    return queryResult.matches || [];
  } catch (error: unknown) {
    logger.error({ error }, "Error searching memories");
    throw error;
  }
};

export const deleteMemory = async (
  hash: string,
  namespace = "default"
): Promise<void> => {
  try {
    const idx = await getIndex();
    const index = idx.namespace(namespace);
    await index.deleteOne(hash);
    logger.info({ hash }, "Deleted memory from Pinecone");
  } catch (error: unknown) {
    logger.error({ error }, "Error deleting memory");
    throw error;
  }
};