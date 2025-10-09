import { Experimental_Agent as Agent, stepCountIs } from "ai";
import type { Message } from "discord.js";
import type { RequestHints } from "@/types/request";
import { systemPrompt } from "../prompts";
import { provider } from "../providers";
import { react, reply, skip, startDM, memories } from "./tools/chat";
import { searchWeb } from "../tools/search-web";
import { getWeather } from "../tools/get-weather";
import { getUserInfo } from "../tools/get-user-info";
import { saveToolMemory } from "@/lib/memory";
import { successToolCall } from "../utils";

export const orchestratorAgent = ({ message, hints }: {
    message: Message,
    hints: RequestHints
}) => new Agent({
    model: provider.languageModel('chat-model'),
    system: systemPrompt({
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
    tools: {
        getWeather,
        searchWeb,
        startDM: startDM({ message }),
        getUserInfo: getUserInfo({ message }),
        react: react({ message }),
        reply: reply({ message }),
        skip: skip({ message }),
        memories: memories({ message, hints }),
    },
    temperature: 0,
    onStepFinish: async ({ toolCalls = [], toolResults = [] }) => {
        if (!toolCalls.length) return;

        await Promise.all(
            toolCalls.map(async (call, i) => {
                const result = toolResults[i];
                if (!call || !result) return;
                if (call.toolName === 'searchMemories') return;

                await saveToolMemory(message, call.toolName, result);
            })
        );
    }
});
