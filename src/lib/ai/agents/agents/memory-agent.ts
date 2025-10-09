import { Agent } from "@ai-sdk-tools/agents";
import { searchMemories, listGuilds } from "../tools/memory";
import { systemPrompt } from "../../prompts";
import type { Message } from "discord.js";
import type { RequestHints } from "@/types/request";
import { provider } from "../../providers";

export const memoryAgent = ({ message, hints }: { message: Message, hints: RequestHints }) => new Agent({
  name: "Memory Agent",
  model: provider.languageModel('agent-model'),
  instructions: systemPrompt({
    agent: 'memory',
    message,
    requestHints: hints,
  }),
  tools: {
    searchMemories: searchMemories({ message }),
    listGuilds: listGuilds({ message }),
  },
  maxTurns: 5,
});