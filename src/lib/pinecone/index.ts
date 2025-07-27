import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "@/env";

export const pinecone = new Pinecone({ apiKey: env.PINECONE_API_KEY });
export const getIndex = async ({ name = env.PINECONE_INDEX }: { name?: string }) => {
  const indexes = (await pinecone.listIndexes())?.indexes;

  if (!indexes || indexes.filter(i => i.name === name).length !== 1) {
    throw new Error(`Index ${name} does not exist`)
  }

  const index = pinecone.Index(name);
  return index;
};
