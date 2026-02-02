import { Honcho } from '@honcho-ai/sdk';
import { env } from '@/env';
let honchoClient: Honcho | null = null;

export function getHonchoClient(): Honcho {
  if (!honchoClient) {
    honchoClient = new Honcho({
      apiKey: env.HONCHO_API_KEY,
      baseURL: env.HONCHO_BASE_URL,
      workspaceId: env.HONCHO_WORKSPACE_ID,
    });
  }
  return honchoClient;
}

export function getWorkspaceId(): string {
  return env.HONCHO_WORKSPACE_ID;
}
