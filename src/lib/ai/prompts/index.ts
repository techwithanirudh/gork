import type { Message } from 'discord.js';
import type { SafetyMode } from '@/lib/kv';
import type { RequestHints } from '@/types';
import { corePrompt } from './core';
import { examplesPrompt } from './examples';
import { personalityPrompt } from './personality';
import { safetyPrompt } from './safety';
import { relevancePrompt } from './tasks/relevance';
import { replyPrompt } from './tasks/reply';
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
  agent,
  requestHints,
  message,
  safetyMode = 'unfiltered',
}: {
  agent: string;
  requestHints: RequestHints;
  message?: Message;
  safetyMode?: SafetyMode;
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);
  const safety = safetyMode === 'safe' ? safetyPrompt : undefined;

  if (agent === 'chat') {
    return [
      corePrompt,
      personalityPrompt,
      examplesPrompt,
      requestPrompt,
      safety,
      toolsPrompt,
      replyPrompt,
    ]
      .filter(Boolean)
      .join('\n\n')
      .trim();
  }
  if (agent === 'relevance') {
    return [
      corePrompt,
      personalityPrompt,
      examplesPrompt,
      requestPrompt,
      safety,
      relevancePrompt(message),
    ]
      .filter(Boolean)
      .join('\n\n')
      .trim();
  }
};
