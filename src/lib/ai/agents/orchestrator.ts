import { Agent } from "@ai-sdk-tools/agents";
import { memoryAgent } from "./agents/memory-agent";
import type { Message } from "discord.js";
import type { RequestHints } from "@/types/request";
import { systemPrompt } from "../prompts";
import { provider } from "../providers";

/**
 * Financial Assistant Orchestrator
 *
 * Main entry point that routes user queries to appropriate specialist agents
 */
export const orchestratorAgent = ({ message, hints }: {
    message: Message,
    hints: RequestHints
}) => Agent.create({
    name: "Orchestrator",
    model: provider.languageModel('chat-model'),
    instructions: systemPrompt({
        agent: 'chat',
        message,
        requestHints: hints,
    }),
    handoffs: [memoryAgent],
    maxTurns: 3,
    temperature: 0,
});