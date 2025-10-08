import type { StopCondition } from "ai";

export function successToolCall(toolName: string): StopCondition<any> {
    return ({ steps }) =>
        steps[steps.length - 1]?.toolResults?.some(
            toolResult => toolResult.toolName === toolName && (toolResult.output as any)?.success
        ) ?? false;
}
