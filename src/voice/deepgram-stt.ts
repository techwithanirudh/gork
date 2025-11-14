import WebSocket from 'ws';
import { createLogger } from '@/lib/logger';

const logger = createLogger('voice:deepgram-stt');

interface DeepgramConfig {
  apiKey: string;
  model?: string;
  language?: string;
  punctuate?: boolean;
  interim_results?: boolean;
  endpointing?: number;
  vad_events?: boolean;
}

interface TranscriptionResult {
  channel_index: number;
  duration: number;
  start: number;
  is_final: boolean;
  speech_final: boolean;
  channel: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
      words?: Array<{
        word: string;
        start: number;
        end: number;
        confidence: number;
      }>;
    }>;
  };
}

export class DeepgramSTT {
  private ws: WebSocket | null = null;
  private config: DeepgramConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnected = false;
  private keepAliveInterval: NodeJS.Timeout | null = null;

  private verbose = false;
  private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private audioBytesSent = 0;
  private transcriptsReceived = 0;

  constructor(config?: Partial<DeepgramConfig>) {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    logger.info({ apiKey }, 'DEEPGRAM_API_KEY');
    if (!apiKey) throw new Error('DEEPGRAM_API_KEY not set');

    this.config = {
      apiKey,
      model: config?.model || 'nova-2',
      language: config?.language || 'en-US',
      punctuate: config?.punctuate ?? true,
      interim_results: config?.interim_results ?? true,
      endpointing: config?.endpointing ?? 10,
      vad_events: config?.vad_events ?? true,
    };

    // Check for verbose mode
    this.verbose = process.env.VERBOSE === 'true' || process.env.DEBUG?.includes('deepgram') || false;
    if (this.verbose) {
      logger.info('[VERBOSE] DeepgramSTT initialized in verbose mode');
    }
  }

  setVerbose(enabled: boolean): void {
    this.verbose = enabled;
    logger.info(`[VERBOSE] Deepgram STT verbose mode: ${enabled}`);
  }

  getConnectionState(): string {
    return this.connectionState;
  }

  /**
   * Connect to Deepgram Live WebSocket
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.connectionState = 'connecting';
        
        const params = new URLSearchParams({
          model: this.config.model!,
          language: this.config.language!,
          punctuate: String(this.config.punctuate),
          interim_results: String(this.config.interim_results),
          endpointing: String(this.config.endpointing),
          vad_events: String(this.config.vad_events),
          encoding: 'linear16',
          sample_rate: '16000',
          channels: '1',
        });

        const url = `wss://api.deepgram.com/v1/listen?${params}`;

        if (this.verbose) {
          logger.info(`[VERBOSE] Connecting to Deepgram WebSocket: ${url.replace(this.config.apiKey, 'REDACTED')}`);
        }

        this.ws = new WebSocket(url, {
          headers: {
            Authorization: `Token ${this.config.apiKey}`,
          },
        });

        this.ws.on('open', () => {
          logger.info('Connected to Deepgram Live WebSocket');
          this.isConnected = true;
          this.connectionState = 'connected';
          this.reconnectAttempts = 0;
          this.startKeepAlive();
          
          if (this.verbose) {
            logger.info('[VERBOSE] Deepgram WebSocket connection established');
          }
          
          resolve();
        });

        this.ws.on('error', (err: Error) => {
          logger.error(`Deepgram WebSocket error: ${err}`);
          if (!this.isConnected) {
            reject(err);
          }
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          logger.info(`Deepgram WebSocket closed: ${code} - ${reason}`);
          this.isConnected = false;
          this.stopKeepAlive();
          this.handleReconnect();
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Send audio data to Deepgram
   */
  sendAudio(audioBuffer: Buffer): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (this.verbose) {
        logger.warn(`[VERBOSE] Cannot send audio - WebSocket state: ${this.connectionState}, readyState: ${this.ws?.readyState}`);
      } else {
        logger.warn('Cannot send audio - WebSocket not connected');
      }
      return;
    }

    try {
      this.ws.send(audioBuffer);
      this.audioBytesSent += audioBuffer.length;
      
      if (this.verbose) {
        logger.debug(`[VERBOSE] Sent ${audioBuffer.length} bytes to Deepgram | Total sent: ${this.audioBytesSent} bytes`);
      }
    } catch (err) {
      logger.error(`Failed to send audio to Deepgram: ${err}`);
    }
  }

  /**
   * Listen for transcription results
   */
  onTranscription(callback: (transcript: string, isFinal: boolean) => void): void {
    if (!this.ws) {
      logger.error('WebSocket not initialized');
      return;
    }

    this.ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        if (this.verbose) {
          logger.debug(`[VERBOSE] Deepgram message type: ${message.type}`);
        }

        // Handle different message types
        if (message.type === 'Results') {
          const result = message as { channel: TranscriptionResult['channel'] };
          const alternative = result.channel?.alternatives?.[0];
          
          if (alternative && alternative.transcript) {
            this.transcriptsReceived++;
            if (this.verbose) {
              logger.info(`[VERBOSE] Transcript #${this.transcriptsReceived}: "${alternative.transcript}" (final: ${message.is_final})`);
            }
            callback(alternative.transcript, message.is_final || false);
          }
        } else if (message.type === 'Metadata') {
          if (this.verbose) {
            logger.info(`[VERBOSE] Deepgram metadata: ${JSON.stringify(message)}`);
          }
        } else if (message.type === 'SpeechStarted') {
          if (this.verbose) {
            logger.info('[VERBOSE] Speech started detected');
          }
        } else if (message.type === 'UtteranceEnd') {
          if (this.verbose) {
            logger.info('[VERBOSE] Utterance end detected');
          }
        }
      } catch (err) {
        logger.error(`Failed to parse Deepgram message: ${err}`);
      }
    });
  }

  /**
   * Close the WebSocket connection
   */
  disconnect(): void {
    this.stopKeepAlive();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Handle reconnection logic
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached for Deepgram');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    logger.info(`Attempting to reconnect to Deepgram in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(async () => {
      try {
        await this.connect();
        logger.info('Successfully reconnected to Deepgram');
      } catch (err) {
        logger.error(`Failed to reconnect to Deepgram: ${err}`);
        this.handleReconnect();
      }
    }, delay);
  }

  /**
   * Send keep-alive messages to prevent connection timeout
   */
  private startKeepAlive(): void {
    this.keepAliveInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send a keep-alive message (empty JSON)
        this.ws.send(JSON.stringify({ type: 'KeepAlive' }));
      }
    }, 8000); // Send every 8 seconds
  }

  /**
   * Stop keep-alive messages
   */
  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  /**
   * Check if connected
   */
  isReady(): boolean {
    return this.isConnected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}