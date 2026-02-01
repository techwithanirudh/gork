import type { RequestHints } from '@/types/request';
import { Experimental_Agent as Agent, stepCountIs } from 'ai';
import type { Message } from 'discord.js';
import type { MemoryContext } from '../tools/chat/memories';
import { systemPrompt } from '../../prompts';
import { provider } from '../../providers';
import {
  getMemory,
  rememberFact,
  forgetFact,
  listChannels,
  listDMs,
  listGuilds,
  listUsers,
  searchMemories,
} from '../tools/memory';

export const memoryAgent = ({
  message,
  hints,
  context,
}: {
  message: Message;
  hints: RequestHints;
  context?: MemoryContext;
}) =>
  new Agent({
    model: provider.languageModel('agent-model'),
    instructions: systemPrompt({
      agent: 'memory',
      message,
      requestHints: hints,
      memoryContext: context,
    }),
    tools: {
      searchMemories: searchMemories({ context }),
      listGuilds: listGuilds({ message }),
      listChannels: listChannels({ message }),
      listDMs: listDMs({ message }),
      listUsers: listUsers({ message }),
      getMemory: getMemory({ message }),
      rememberFact: rememberFact({ message }),
      forgetFact: forgetFact({ message }),
    },
    temperature: 0,
    stopWhen: [stepCountIs(5)],
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'memory',
      metadata: {
        userId: message.author.id,
        guildId: message.guild?.id ?? 'DM',
      },
    },
  });
