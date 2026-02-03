import type { ContextResult } from '@/lib/memory/honcho';
import type { RequestHints } from '@/types';
import type { Message } from 'discord.js';
import { corePrompt } from './core';
import { examplesPrompt } from './examples';
import { memoryPrompt } from './memory';
import { personalityPrompt } from './personality';
import { relevancePrompt, replyPrompt, voicePrompt } from './tasks';
import { toolsPrompt } from './tools';

export type { ContextResult };

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

export const formatContext = (context?: ContextResult | null) => {
  if (!context?.userRepresentation) return '';

  return `<user_context>
What you know about this user from previous interactions:
${context.userRepresentation}
</user_context>`;
};

export const systemPrompt = ({
  agent,
  requestHints,
  message,
  speakerName,
  context,
}: {
  agent: string;
  requestHints: RequestHints;
  message?: Message;
  speakerName?: string;
  context?: ContextResult | null;
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);
  const contextPrompt = formatContext(context);

  if (agent === 'chat') {
    return [
      corePrompt,
      personalityPrompt,
      examplesPrompt,
      memoryPrompt,
      requestPrompt,
      contextPrompt,
      toolsPrompt,
      replyPrompt,
    ]
      .filter(Boolean)
      .join('\n\n')
      .trim();
  } else if (agent === 'relevance') {
    return [
      corePrompt,
      personalityPrompt,
      examplesPrompt,
      requestPrompt,
      relevancePrompt(message),
    ]
      .filter(Boolean)
      .join('\n\n')
      .trim();
  } else if (agent === 'voice') {
    return [
      corePrompt,
      personalityPrompt,
      examplesPrompt,
      requestPrompt,
      voicePrompt(speakerName),
    ]
      .filter(Boolean)
      .join('\n\n')
      .trim();
  }
};
