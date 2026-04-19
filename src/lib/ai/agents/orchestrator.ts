import { stepCountIs, ToolLoopAgent } from 'ai';
import type { Message } from 'discord.js';
import { saveToolMemory } from '@/lib/memory';
import type { RequestHints } from '@/types/request';
import { systemPrompt } from '../prompts';
import { provider } from '../providers';
import { createToolset } from '../tools';
import { successToolCall } from '../utils/tools';

export const orchestratorAgent = ({
  message,
  hints,
}: {
  message: Message;
  hints: RequestHints;
}) =>
  new ToolLoopAgent({
    model: provider.languageModel('chat-model'),
    instructions: systemPrompt({
      agent: 'chat',
      message,
      requestHints: hints,
    }),
    stopWhen: [
      stepCountIs(10),
      successToolCall('reply'),
      successToolCall('react'),
      successToolCall('skip'),
    ],
    toolChoice: 'required',
    tools: createToolset({ message }),
    temperature: 0,
    onStepFinish: async ({ toolCalls = [], toolResults = [] }) => {
      if (!toolCalls.length) {
        return;
      }

      await Promise.all(
        toolCalls.map(async (call, i) => {
          const result = toolResults[i];
          if (!(call && result)) {
            return;
          }
          if (
            call.toolName === 'memories' ||
            call.toolName === 'searchMemories'
          ) {
            return;
          }
          if (
            call.toolName === 'reply' ||
            call.toolName === 'skip' ||
            call.toolName === 'react'
          ) {
            return;
          }

          await saveToolMemory(message, call.toolName, result);
        })
      );
    },
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'orchestrator',
      metadata: {
        message: message.content,
        hints: JSON.stringify(hints),
        userId: message.author.id,
        guildId: message.guild?.id ?? 'DM',
      },
    },
  });
