import { memoryAgent } from "../../agents";
import { tool } from "ai";
import { z } from "zod";
import type { Message } from "discord.js";
import type { RequestHints } from "@/types/request";

export const memories = ({ message, hints }: { message: Message, hints: RequestHints }) => tool({
    description: 'Search through stored memories using a text query.',
    inputSchema: z.object({
        query: z.string().describe('The text query to search for in memories'),
    }),
    execute: async ({ query }) => {
        const agent = memoryAgent({ message, hints });

        return agent.generate({
            prompt: query,
        });
    }
});
