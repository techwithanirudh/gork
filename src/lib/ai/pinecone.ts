import { Pinecone, type ScoredPineconeRecord } from "@pinecone-database/pinecone";
import { env } from "@/env";
import logger from "@/lib/logger";

export type Metadata = {
  url: string,
  text: string,
  chunk: string,
  hash: string
}

const getMatchesFromEmbeddings = async (embeddings: number[], topK: number, namespace: string): Promise<ScoredPineconeRecord<Metadata>[]> => {
  const pinecone = new Pinecone();

  const indexName = env.PINECONE_INDEX;
  const indexes = (await pinecone.listIndexes())?.indexes;
  if (!indexes || indexes.filter(i => i.name === indexName).length !== 1) {
    throw new Error(`Index ${indexName} does not exist`)
  }

  const index = pinecone.Index<Metadata>(indexName);
  const pineconeNamespace = index.namespace(namespace ?? '')

  try {
    const queryResult = await pineconeNamespace.query({
      vector: embeddings,
      topK,
      includeMetadata: true,
    })
    return queryResult.matches || []
  } catch (e) {
    logger.error({ error: e }, "Error querying embeddings")
    throw new Error(`Error querying embeddings: ${e}`)
  }
}

export { getMatchesFromEmbeddings }