import { env } from '@/env';
import { createClient } from '@deepgram/sdk';
import { Readable } from 'node:stream';

export const deepgram = createClient(env.DEEPGRAM_API_KEY);

type SpeakProps = {
  text: string;
  model: string;
};

export async function speak({ text, model }: SpeakProps) {
  const response = await deepgram.speak.request(
    {
      text,
    },
    {
      model: model,
    }
  );

  const webStream = await response.getStream();

  if (!webStream) {
    throw new Error('Failed to get audio stream from Deepgram');
  }

  const reader = webStream.getReader();
  const nodeStream = new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
        } else {
          this.push(Buffer.from(value));
        }
      } catch (error) {
        this.destroy(error instanceof Error ? error : new Error(String(error)));
      }
    },
  });

  return nodeStream;
}
