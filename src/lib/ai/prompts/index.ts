import type { RequestHints } from '@/types';
import type { Message } from 'discord.js';
import type { MemoryContext } from '../agents/tools/chat/memories';
import type { MemoryResult } from '@/lib/memory';
import { formatWorkingMemory } from '@/lib/memory';
import { corePrompt } from './core';
import { examplesPrompt } from './examples';
import { personalityPrompt } from './personality';
import {
  memoryPromptParts,
  relevancePrompt,
  replyPrompt,
  voicePrompt,
} from './tasks';
import { toolsPrompt } from './tools';

/**
 * WorkingMemory type - now uses mem0's MemoryResult array
 */
export type WorkingMemory = MemoryResult[] | null;

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

export const getMemoryContextPrompt = (context?: MemoryContext) => {
  if (!context) return '';

  const lines = ['<current_scope>'];
  lines.push(
    'CRITICAL: Read this block BEFORE every search. These are the IDs you need for filters.',
  );
  lines.push('');

  if (context.guildId) {
    lines.push(`Guild: ${context.guildName ?? 'Unknown'}`);
    lines.push(`  guildId: "${context.guildId}"`);
  }
  lines.push(`Channel: ${context.channelName ?? 'Unknown'}`);
  lines.push(`  channelId: "${context.channelId}"`);

  if (context.participants.length > 0) {
    lines.push('');
    lines.push('Participants (use these IDs for participantIds filter):');
    for (const p of context.participants) {
      const displayInfo = p.displayName
        ? ` (display name: "${p.displayName}")`
        : '';
      lines.push(`  - "${p.username}" → ID: "${p.id}"${displayInfo}`);
    }
  }

  lines.push('</current_scope>');

  return lines.join('\n');
};

export const systemPrompt = ({
  agent,
  requestHints,
  message,
  speakerName,
  memoryContext,
  workingMemory,
}: {
  agent: string;
  requestHints: RequestHints;
  message?: Message;
  speakerName?: string;
  memoryContext?: MemoryContext;
  workingMemory?: WorkingMemory | null;
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);
  const workingMemoryPrompt = formatWorkingMemory(workingMemory ?? null);

  if (agent === 'chat') {
    return [
      corePrompt,
      personalityPrompt,
      examplesPrompt,
      requestPrompt,
      workingMemoryPrompt,
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
  } else if (agent === 'memory') {
    const memoryContextPrompt = getMemoryContextPrompt(memoryContext);
    // Inject <current_scope> between criticalRules and workflow for optimal positioning
    return [
      corePrompt,
      memoryPromptParts.identity,
      memoryPromptParts.criticalRules,
      memoryContextPrompt, // <current_scope> appears right after critical rules
      memoryPromptParts.workflow,
      memoryPromptParts.filters,
      memoryPromptParts.searchStrategy,
      memoryPromptParts.examples,
      memoryPromptParts.outputFormat,
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
