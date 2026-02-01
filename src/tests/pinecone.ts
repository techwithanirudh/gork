import { queryMemories } from '@/lib/memory';

const query = 'who is gork known as';
const memories = await queryMemories(query, {
  ignoreRecent: false,
});

console.log(memories);
