import bm25 from "wink-bm25-text-search";
import logger from "@/lib/logger";

// Initialize BM25 search engine
const engine = bm25();

// Configure BM25 parameters
engine.defineConfig({
  fldWeights: {
    text: 1,  // Weight for the text field
  },
  bm25Params: {
    k1: 1.2,  // Term frequency saturation parameter
    b: 0.75,  // Length normalization parameter
    k: 1,     // IDF parameter
  }
});

// Define text preprocessing tasks
engine.definePrepTasks([
  // Convert to lowercase
  (text: string) => text.toLowerCase(),
  // Split into words and remove punctuation
  (text: string) => text.split(/[\s,.!?;:'")\-(\[\]{}]+/).filter(Boolean)
]);

interface BM25Doc {
  text: string;
  id: string;
}

// Add or update a document in the BM25 index
export const addToBM25 = (doc: BM25Doc): void => {
  try {
    engine.addDoc({ text: doc.text }, doc.id);
    logger.info({ id: doc.id }, "Added document to BM25 index");
  } catch (error: unknown) {
    logger.error({ error }, "Error adding document to BM25 index");
    throw error;
  }
};

// Remove a document from the BM25 index
export const removeFromBM25 = (id: string): void => {
  try {
    engine.reset();  // BM25 doesn't support individual document removal
    logger.info({ id }, "Reset BM25 index");
  } catch (error: unknown) {
    logger.error({ error }, "Error removing document from BM25 index");
    throw error;
  }
};

// Search using BM25
export const searchBM25 = (query: string, limit = 5): Array<[string, number]> => {
  try {
    // Make sure the index is consolidated before searching
    engine.consolidate();
    return engine.search(query, limit);
  } catch (error: unknown) {
    logger.error({ error }, "Error searching BM25 index");
    throw error;
  }
};

// Export the BM25 index for persistence
export const exportBM25 = (): string => {
  try {
    return engine.exportJSON();
  } catch (error: unknown) {
    logger.error({ error }, "Error exporting BM25 index");
    throw error;
  }
};

// Import a previously exported BM25 index
export const importBM25 = (json: string): void => {
  try {
    engine.importJSON(json);
    logger.info("Imported BM25 index");
  } catch (error: unknown) {
    logger.error({ error }, "Error importing BM25 index");
    throw error;
  }
};
