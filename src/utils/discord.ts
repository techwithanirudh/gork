import {
  MessageEmbed,
  type EmbedField as APIEmbedField,
} from 'discord.js-selfbot-v13';

/**
 * Default language for code blocks when `code` is boolean or language not specified.
 */
export const DEFAULT_CODE_LANGUAGE = 'javascript';

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
  /**
   * Code formatting options:
   * - `true` uses default language
   * - `{ enabled?: boolean; language?: string }` for custom settings
   */
  code?: boolean | { enabled?: boolean; language?: string };
}

export interface MakeEmbedOptions {
  title?: string;
  description?: string;
  color?: number;
  fields?: EmbedField[];
}

export function makeEmbed(options: MakeEmbedOptions): MessageEmbed {
  const { title, description, color, fields } = options;
  const embed = new MessageEmbed();

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (typeof color === 'number') embed.setColor(color);

  if (fields && fields.length) {
    const apiFields: APIEmbedField[] = fields.map((f) => {
      let val = f.value;
      const codeOpt = f.code;
      let isEnabled = false;
      let lang = DEFAULT_CODE_LANGUAGE;

      if (codeOpt) {
        if (typeof codeOpt === 'object') {
          isEnabled = codeOpt.enabled !== false;
          if (codeOpt.language) {
            lang = codeOpt.language;
          }
        } else {
          isEnabled = true;
        }
      }

      if (isEnabled) {
        val = `\`\`\`${lang}\n${f.value.trim()}\n\`\`\``;
      }

      return {
        name: f.name,
        value: val,
        inline: f.inline ?? false,
      };
    });
    embed.setFields(apiFields);
  }

  // timestamp
  embed.setTimestamp(new Date());

  return embed;
}

export function scrub(obj: unknown) {
  return JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}
