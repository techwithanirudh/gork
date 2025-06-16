import { tool } from 'ai';
import { z } from 'zod/v4';
import { exa } from "@/lib/search";

export const searchWeb = tool({
    description: "Use this to search the web for information",
    parameters: z.object({
        query: z.string(),
        specificDomain: z
            .string()
            .nullable()
            .describe(
                "a domain to search if the user specifies e.g. bbc.com. Should be only the domain name without the protocol",
            ),
    }),
    execute: async ({ query, specificDomain }) => {
        const { results } = await exa.searchAndContents(query, {
            livecrawl: "always",
            numResults: 3,
            includeDomains: specificDomain ? [specificDomain] : undefined,
        });

        console.log(results)

        return {
            results: results.map((result) => ({
                title: result.title,
                url: result.url,
                snippet: result.text.slice(0, 1000),
            })),
        };
    },
})
