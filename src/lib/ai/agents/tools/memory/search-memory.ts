import { formatMemories, scopedUserId, searchMemories } from '@/lib/memory';
import { createLogger } from '@/lib/logger';
import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';

const logger = createLogger('tools:search-memory');

const LOGICAL_KEYS = new Set(['AND', 'OR', 'NOT']);
const OPERATOR_KEYS = new Set([
  'eq',
  'ne',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'nin',
  'contains',
  'icontains',
  '*',
]);

const ALLOWED_FILTER_KEYS = new Set([
  'version',
  'type',
  'sessionId',
  'sessionType',
  'guildId',
  'guildName',
  'channelId',
  'channelName',
  'channelType',
  'participantIds',
  'entityIds',
  'createdAt',
  'lastRetrievalTime',
  ...LOGICAL_KEYS,
]);

export const searchMemory = ({ message }: { message: Message }) =>
  tool({
    description:
      'Search stored memories using a semantic text query. ' +
      'Always include guildId for server queries. ' +
      'Allowed filter keys: version, type, sessionId, sessionType, guildId, guildName, ' +
      'channelId, channelName, channelType, participantIds, entityIds, createdAt, lastRetrievalTime, AND, OR, NOT.',
    inputSchema: z.object({
      query: z
        .string()
        .describe('Semantic search phrase with multiple related terms'),
      limit: z
        .number()
        .int()
        .positive()
        .max(20)
        .default(5)
        .describe('Number of results (max: 20)'),
      userId: z
        .string()
        .nullable()
        .describe(
          'Discord user ID to scope search (default: requester). ' +
            'If you already have a scoped ID, pass it as-is.',
        ),
      filter: z
        .record(z.string(), z.unknown())
        .nullable()
        .describe(
          'Metadata filters using mem0 syntax with AND/OR/NOT and operators.',
        ),
    }),
    execute: async ({ query, limit, userId, filter }) => {
      try {
        if (!query?.trim()) {
          return {
            success: true,
            data: {
              memories: '',
              query: '',
              limit,
              filter: null,
              message: 'No query provided',
            },
          };
        }

        const sanitizedFilter = sanitizeFilter(filter ?? undefined);
        const finalFilter = applyGuildDefault(sanitizedFilter, message);
        const resolvedUserId = resolveUserId(userId, message);

        const results = await searchMemories(query, resolvedUserId, {
          limit,
          filters: finalFilter ?? undefined,
        });

        const memories = formatMemories(results);

        return {
          success: true,
          data: {
            memories,
            query: query.trim(),
            limit,
            userId: resolvedUserId,
            filter: finalFilter ?? null,
            resultsFound: results.length,
            message: memories
              ? 'Memory search completed.'
              : 'No matching memories found.',
          },
        };
      } catch (error) {
        logger.error({ error }, 'Error in searchMemory tool');
        return { success: false, error: 'Failed to search memories' };
      }
    },
  });

function resolveUserId(
  rawUserId: string | null | undefined,
  message: Message,
): string {
  if (rawUserId) {
    if (rawUserId.startsWith('guild:') || rawUserId.startsWith('dm:')) {
      return rawUserId;
    }
    return scopedUserId(message.guild?.id ?? null, rawUserId);
  }

  return scopedUserId(message.guild?.id ?? null, message.author.id);
}

function applyGuildDefault(
  filter: Record<string, unknown> | undefined,
  message: Message,
): Record<string, unknown> | undefined {
  if (!message.guild?.id) return filter;

  if (hasKeyDeep(filter, 'guildId')) {
    return filter;
  }

  if (!filter) {
    return { guildId: message.guild.id };
  }

  return {
    AND: [{ guildId: message.guild.id }, filter],
  };
}

function sanitizeFilter(
  filter?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!filter) return undefined;
  return sanitizeValue(filter) as Record<string, unknown>;
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const entries = value
      .map((entry) => sanitizeValue(entry))
      .filter((entry) => entry !== undefined);
    return entries.length ? entries : undefined;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  const isOperatorObject =
    keys.length > 0 && keys.every((key) => OPERATOR_KEYS.has(key));

  if (isOperatorObject) {
    const normalized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(obj)) {
      normalized[key] = sanitizeValue(entry);
    }
    return normalized;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(obj)) {
    if (!ALLOWED_FILTER_KEYS.has(key)) continue;

    if (LOGICAL_KEYS.has(key)) {
      const logicalValue = sanitizeValue(entry);
      if (logicalValue !== undefined) {
        sanitized[key] = logicalValue;
      }
      continue;
    }

    sanitized[key] = sanitizeValue(entry);
  }

  return Object.keys(sanitized).length ? sanitized : undefined;
}

function hasKeyDeep(
  filter: Record<string, unknown> | undefined,
  key: string,
): boolean {
  if (!filter) return false;
  if (key in filter) return true;

  for (const value of Object.values(filter)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry && typeof entry === 'object') {
          if (hasKeyDeep(entry as Record<string, unknown>, key)) return true;
        }
      }
    } else if (value && typeof value === 'object') {
      if (hasKeyDeep(value as Record<string, unknown>, key)) return true;
    }
  }

  return false;
}
