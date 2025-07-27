import { addMemory, searchMemories } from './lib/pinecone/queries';

await addMemory('anirudh is the best coder ever', {
  createdAt: new Date().getTime(),
  lastRetrievalTime: new Date().getTime(),
});
const result = await searchMemories('who is the best coder');
console.log(result);
