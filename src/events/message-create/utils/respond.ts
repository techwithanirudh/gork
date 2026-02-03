import { orchestratorAgent } from '@/lib/ai/agents/orchestrator';
import {
  getContext,
  buildMessageContext,
  type ContextResult,
} from '@/lib/memory/honcho';
import { createLogger } from '@/lib/logger';
import type { RequestHints } from '@/types';
import type { ModelMessage } from 'ai';
import type { Message } from 'discord.js';

const logger = createLogger('ai:tool-steps');

export async function generateResponse(
  msg: Message,
  messages: ModelMessage[],
  hints: RequestHints,
) {
  try {
    const ctx = buildMessageContext(msg);

    const context = await getContext(ctx, {});
    const agent = orchestratorAgent({
      message: msg,
      hints,
      context,
    });
    const { toolCalls } = await agent.generate({
      messages: [
        ...messages,
        {
          role: 'user',
          content: 'You are replying to the following message: ' + msg.content,
        },
      ],
      onStepFinish: ({ toolCalls, toolResults, finishReason }) => {
        if (!toolCalls?.length && !toolResults?.length) return;

        const normalizedCalls = (toolCalls ?? []).map((call: any) => ({
          toolName: call.toolName ?? call.name ?? 'unknown',
          toolCallId: call.toolCallId ?? call.id,
          input: call.input ?? call.args ?? call.arguments ?? call,
        }));

        const normalizedResults = (toolResults ?? []).map((result: any) => ({
          toolName: result.toolName ?? result.name ?? 'unknown',
          toolCallId: result.toolCallId ?? result.id,
          output: result.output ?? result.result ?? result,
          isError: result.isError,
        }));

        logger.info(
          {
            finishReason,
            toolCalls: normalizedCalls,
            toolResults: normalizedResults,
          },
          'Tool step finished',
        );
      },
    });

    return { success: true, toolCalls };
  } catch (e) {
    return {
      success: false,
      error: (e as Error)?.message,
    };
  }
}
