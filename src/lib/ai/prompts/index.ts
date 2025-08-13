import type { PineconeMetadataOutput, RequestHints } from '@/types';
import type { ScoredPineconeRecord } from '@pinecone-database/pinecone';
import { corePrompt } from './core';
import { examplesPrompt } from './examples';
import { formatMemoriesForPrompt } from './memories';
import { personalityPrompt } from './personality';
import { relevancePrompt, replyPrompt } from './tasks';
import { toolsPrompt } from './tools';

export const getRequestPromptFromHints = (requestHints: RequestHints) => `\
<context>
You live in ${requestHints.city}, ${requestHints.country}.
In ${requestHints.city} and the date and time is ${requestHints.time}.
You're in the ${requestHints.server} Discord Server, and in the ${
  requestHints.channel
} channel.
You joined the server on ${new Date(requestHints.joined).toLocaleDateString()}.
Your current status is ${requestHints.status} and your activity is ${
  requestHints.activity
}.
</context>`;

export const systemPrompt = ({
  selectedChatModel,
  requestHints,
  memories,
}: {
  selectedChatModel: string;
  requestHints: RequestHints;
  memories: ScoredPineconeRecord<PineconeMetadataOutput>[];
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);
  const memoriesText = formatMemoriesForPrompt(memories);
  if (selectedChatModel === 'chat-model') {
    return [
      corePrompt,
      personalityPrompt,
      examplesPrompt,
      requestPrompt,
      toolsPrompt,
      memoriesText,
      replyPrompt,
    ]
      .filter(Boolean)
      .join('\n')
      .trim();
  } else if (selectedChatModel === 'relevance-model') {
    return [
      corePrompt,
      personalityPrompt,
      examplesPrompt,
      requestPrompt,
      memoriesText,
      relevancePrompt,
    ]
      .filter(Boolean)
      .join('\n\n')
      .trim();
  }
};
