import { searchMemories } from './lib/pinecone/queries';

const result = await searchMemories('do you remember my friend?');
console.log(result);
