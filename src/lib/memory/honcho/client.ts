import { Honcho } from '@honcho-ai/sdk';
import { env } from '@/env';
import { createLogger } from '@/lib/logger';

const logger = createLogger('honcho:client');

let honchoClient: Honcho | null = null;

export function getHonchoClient(): Honcho {
  if (!honchoClient) {
    honchoClient = new Honcho({
      apiKey: env.HONCHO_API_KEY,
      baseURL: env.HONCHO_BASE_URL,
      workspaceId: env.HONCHO_WORKSPACE_ID,
    });
    logger.info('Honcho client initialized');
  }
  return honchoClient;
}

export function getWorkspaceId(): string {
  return env.HONCHO_WORKSPACE_ID;
}
