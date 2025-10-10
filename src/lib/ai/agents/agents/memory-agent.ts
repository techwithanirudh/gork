import type { RequestHints } from '@/types/request';
import { Experimental_Agent as Agent, stepCountIs } from 'ai';
import type { Message } from 'discord.js';
import { systemPrompt } from '../../prompts';
import { provider } from '../../providers';
import { listGuilds, searchMemories, listChannels, listDMs, listUsers } from '../tools/memory';

export const memoryAgent = ({
  message,
  hints,
}: {
  message: Message;
  hints: RequestHints;
}) =>
  new Agent({
    model: provider.languageModel('agent-model'),
    system: systemPrompt({
      agent: 'memory',
      message,
      requestHints: hints,
    }),
    tools: {
      searchMemories: searchMemories(),
      listGuilds: listGuilds({ message }),
      listChannels: listChannels({ message }),
      listDMs: listDMs({ message }),
      listUsers: listUsers({ message }),
    },
    toolChoice: 'required',
    stopWhen: [stepCountIs(25)],
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'memory',
      metadata: {
        userId: message.author.id,
        guildId: message.guild?.id ?? 'DM',
      },
    },
  });
