import { Experimental_Agent as Agent, Output } from "ai";
import { searchMemories, listGuilds } from "../tools/memory";
import { systemPrompt } from "../../prompts";
import type { Message } from "discord.js";
import type { RequestHints } from "@/types/request";
import { provider } from "../../providers";
import { stepCountIs } from "ai";
import { probabilitySchema } from "@/lib/validators";

export const relevanceAgent = ({ message, hints }: { message: Message, hints: RequestHints }) => new Agent({
  model: provider.languageModel('relevance-model'),
  system: systemPrompt({
    agent: 'relevance',
    message,
    requestHints: hints,
  }),
  tools: {
    searchMemories: searchMemories(),
    listGuilds: listGuilds({ message }),
  },
  stopWhen: [
    stepCountIs(5),
  ],
  experimental_output: Output.object({
    schema: probabilitySchema,
  })
});

// todo repair text