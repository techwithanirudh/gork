import { addMemory, searchMemories } from './lib/pinecone/queries';

await addMemory('anirudh is the best coder ever', {
  createdAt: Date.now(),
  lastRetrievalTime: Date.now(),
});
const result = await searchMemories('who is the best coder');
console.log(result);
