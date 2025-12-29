import { createLogger } from '@/lib/logger';
import fetch from 'cross-fetch';
import { AIClient } from './ai';
import { DeepgramSTT } from './deepgram-stt';

const logger = createLogger('voice:pipeline');

const DEFAULT_TTS_MODEL = process.env.DG_TTS_MODEL || 'aura-asteria-en';
const DEFAULT_SAMPLE_RATE = 16000; // linear16 mono

export class VoicePipeline {
  private ai: AIClient;
  private deepgramSTT: DeepgramSTT;
  private conversationContext: string[] = [];
  private maxContextLength = 10; // Keep last 5 exchanges
  private verbose = false;
  private audioStats = {
    totalBytes: 0,
    packetsProcessed: 0,
    lastPacketTime: 0,
    emptyPackets: 0,
    silentPackets: 0,
  };

  constructor() {
    this.ai = new AIClient();
    this.deepgramSTT = new DeepgramSTT();

    // Check for verbose mode from environment
    this.verbose =
      process.env.VERBOSE === 'true' ||
      (process.env.DEBUG?.includes('pipeline') ?? false);

    if (this.verbose) {
      logger.info('[VERBOSE] VoicePipeline initialized in verbose mode');
    }
  }

  setVerbose(enabled: boolean): void {
    this.verbose = enabled;
    logger.info(`[VERBOSE] Pipeline verbose mode: ${enabled}`);
  }

  getAudioStats(): any {
    return { ...this.audioStats };
  }

  async connect(): Promise<void> {
    await this.deepgramSTT.connect();
    logger.info('Voice pipeline connected');
  }

  async disconnect(): Promise<void> {
    this.deepgramSTT.disconnect();
    logger.info('Voice pipeline disconnected');
  }

  getSTTClient(): DeepgramSTT {
    return this.deepgramSTT;
  }

  async processAudio(audioBuffer: Buffer): Promise<string> {
    // Update stats
    this.audioStats.packetsProcessed++;
    this.audioStats.lastPacketTime = Date.now();

    if (!audioBuffer || audioBuffer.length === 0) {
      this.audioStats.emptyPackets++;
      if (this.verbose) {
        logger.warn('[VERBOSE] Empty audio buffer received');
      }
      return '';
    }

    this.audioStats.totalBytes += audioBuffer.length;

    // Check if buffer is silence (all zeros or very low values)
    const isSilent = this.detectSilence(audioBuffer);
    if (isSilent) {
      this.audioStats.silentPackets++;
    }

    if (this.verbose) {
      const avgPacketSize =
        this.audioStats.totalBytes / this.audioStats.packetsProcessed;
      logger.debug(
        `[VERBOSE] Processing audio buffer: ${audioBuffer.length} bytes | ` +
          `Total: ${this.audioStats.totalBytes} | Packets: ${this.audioStats.packetsProcessed} | ` +
          `Avg: ${Math.round(avgPacketSize)} | Empty: ${
            this.audioStats.emptyPackets
          } | ` +
          `Silent: ${this.audioStats.silentPackets} | ` +
          `Is Silent: ${isSilent}`
      );
    }

    // Send audio to Deepgram STT
    this.deepgramSTT.sendAudio(audioBuffer);
    // Transcription results come via the onTranscription callback
    return '';
  }

  detectSilence(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 2) return true;

    // Check if audio is silence (very low amplitude)
    // PCM 16-bit samples, so read as 16-bit integers
    let maxAmplitude = 0;
    for (let i = 0; i < Math.min(buffer.length - 1, 1000); i += 2) {
      const sample = Math.abs(buffer.readInt16LE(i));
      maxAmplitude = Math.max(maxAmplitude, sample);
    }

    // Threshold for silence (adjust as needed)
    const silenceThreshold = 500; // Very low amplitude
    const isSilent = maxAmplitude < silenceThreshold;

    if (this.verbose && !isSilent) {
      logger.debug(`[VERBOSE] Audio detected! Max amplitude: ${maxAmplitude}`);
    }

    return isSilent;
  }

  async checkFFmpeg(): Promise<boolean> {
    try {
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        exec('ffmpeg -version', (error: any) => {
          const available = !error;
          if (this.verbose) {
            logger.info(`[VERBOSE] FFmpeg available: ${available}`);
          }
          resolve(available);
        });
      });
    } catch (err) {
      logger.error(`Failed to check FFmpeg: ${err}`);
      return false;
    }
  }

  async generateResponse(text: string): Promise<string> {
    try {
      // Add user input to context
      this.conversationContext.push(text);

      // Generate response using OpenRouter
      const response = await this.ai.generateResponse(
        text,
        this.conversationContext
      );

      // Add response to context
      this.conversationContext.push(response);

      // Trim context if too long
      if (this.conversationContext.length > this.maxContextLength) {
        this.conversationContext = this.conversationContext.slice(
          -this.maxContextLength
        );
      }

      logger.info(`Generated response: ${response.substring(0, 100)}...`);
      return response;
    } catch (err) {
      logger.error(`Failed to generate response: ${err}`);
      return "I'm having trouble processing that right now. Please try again.";
    }
  }

  async synthesizeSpeech(text: string): Promise<Buffer> {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) throw new Error('DEEPGRAM_API_KEY not set');

    // Use Deepgram Speak REST API to get linear16 PCM @ 16kHz mono
    const url = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(
      DEFAULT_TTS_MODEL
    )}&format=linear16&sample_rate=${DEFAULT_SAMPLE_RATE}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      logger.error(
        `Deepgram Speak error: ${resp.status} ${resp.statusText} - ${errText}`
      );
      throw new Error(`Deepgram Speak failed: ${resp.status}`);
    }

    const arrayBuf = await resp.arrayBuffer();
    const pcm = Buffer.from(new Uint8Array(arrayBuf));
    logger.info(
      `synthesizeSpeech() received ${pcm.length} bytes PCM from Deepgram`
    );
    return pcm;
  }

  clearContext(): void {
    this.conversationContext = [];
    logger.info('Conversation context cleared');
  }
}
