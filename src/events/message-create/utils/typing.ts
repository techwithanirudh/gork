import type { Message } from 'discord.js';

export function startTyping(channel: Message['channel']): () => void {
  if (!('sendTyping' in channel) || typeof channel.sendTyping !== 'function') {
    return () => {
      /* no-op */
    };
  }
  const send = () => {
    (channel as { sendTyping(): Promise<void> })
      .sendTyping()
      .catch((_e: unknown) => {
        /* ignore */
      });
  };
  send();
  const interval = setInterval(send, 8000);
  return () => clearInterval(interval);
}
