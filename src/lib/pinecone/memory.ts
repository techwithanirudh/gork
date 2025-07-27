import { type QueryResponse, type ScoredPineconeRecord } from "@pinecone-database/pinecone";
import { getIndex } from "./index";
import logger from "@/lib/logger";
import type { PineconeMetadata } from "@/types";
import { MD5 } from "bun";
import { addToBM25, removeFromBM25, searchBM25 } from "./hybrid";

export interface MemorySearchOptions {
  namespace?: string;
  topK?: number;
  alpha?: number;  // Weight between dense and sparse scores (0-1)
  query?: string; // Optional text query for hybrid search
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

    // Add to Pinecone vector index
    const idx = await getIndex();
    const index = idx.namespace(namespace);
    
    await index.upsert([{
      id: hash,
      values: denseEmbeddings,
      metadata,
    }]);

    // Add to BM25 text index
    addToBM25({ text, id: hash });

    logger.info({ hash }, "Added memory to Pinecone and BM25");
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
    alpha = 0.5,  // Equal weight between dense and sparse by default
    query        // Optional text query
  } = options;

  try {
    // Get dense vector results from Pinecone
    const idx = await getIndex();
    const index = idx.namespace(namespace);
    
    const queryResult = await index.query({
      vector: denseEmbeddings,
      topK: query ? topK * 2 : topK, // Get more results if hybrid search
      includeMetadata: true,
    }) as QueryResponse<PineconeMetadata>;

    const denseResults = queryResult.matches || [];

    // If no text query, return dense results directly
    if (!query) {
      return denseResults;
    }

    // Get sparse vector results from BM25
    const bm25Results = searchBM25(query, topK * 2);

    // Combine and re-rank results
    const combinedScores = new Map<string, number>();
    
    // Add dense scores
    denseResults.forEach(result => {
      combinedScores.set(result.id, (result.score || 0) * (1 - alpha));
    });

    // Add sparse scores
    bm25Results.forEach(([id, score]) => {
      const currentScore = combinedScores.get(id) || 0;
      combinedScores.set(id, currentScore + (score * alpha));
    });

    // Sort and filter results
    const rerankedResults = denseResults
      .filter(result => combinedScores.has(result.id))
      .map(result => ({
        ...result,
        score: combinedScores.get(result.id) || 0
      }))
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, topK);

    return rerankedResults;
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
    // Remove from Pinecone vector index
    const idx = await getIndex();
    const index = idx.namespace(namespace);
    await index.deleteOne(hash);

    // Remove from BM25 text index
    removeFromBM25(hash);

    logger.info({ hash }, "Deleted memory from Pinecone and BM25");
  } catch (error: unknown) {
    logger.error({ error }, "Error deleting memory");
    throw error;
  }
};