import { Controller, Post, Body, Res, HttpException, HttpStatus } from '@nestjs/common';
import { OpenAI } from 'openai';
import { z } from 'zod';
import { Readable } from 'stream';
import { FastifyReply } from 'fastify';

const ttsRequestSchema = z.object({
  text: z.string().min(1),
});

@Controller('openai')
export class TTSController {
  constructor(private readonly openai: OpenAI) {
    this.openai = openai;
  }

  @Post('tts')
  async textToSpeech(@Body('text') text: string, @Res() res: FastifyReply) {
    const requestReceivedTime = Date.now();
    console.log(`[${requestReceivedTime}] TTS: Text received: "${text.substring(0, 50)}..."`);

    try {
      const { text: validatedText } = ttsRequestSchema.parse({ text });

      const beforeApiCallTime = Date.now();
      console.log(`[${beforeApiCallTime}] TTS: Sending to OpenAI API.`);
      const mp3 = await this.openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: validatedText,
      });
      const afterApiCallTime = Date.now();
      console.log(`[${afterApiCallTime}] TTS: Received stream object from OpenAI. Latency: ${afterApiCallTime - beforeApiCallTime}ms`);

      res.header('Content-Type', 'audio/mpeg');
      res.header('Transfer-Encoding', 'chunked');
      res.header('Cache-Control', 'no-cache');
      res.header('Connection', 'keep-alive');

      const audioStream = mp3.body;
      if (!audioStream) {
        throw new Error('No stream available from OpenAI');
      }

      const nodeStream = audioStream as unknown as Readable;
      const rawRes = res.raw;

      rawRes.on('close', () => {
        console.log(`[${Date.now()}] TTS: Client closed connection, attempting to destroy audio stream.`);
        if (!nodeStream.destroyed) {
          nodeStream.destroy();
        }
      });

      nodeStream.on('error', (error) => {
        console.error(`[${Date.now()}] TTS: Error on OpenAI audio stream:`, error);
        if (!res.sent) {
          res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
            error: 'Error streaming audio from source',
          });
        } else if (!rawRes.destroyed) {
          console.log(`[${Date.now()}] TTS: Response headers sent, destroying raw response due to source stream error.`);
          rawRes.destroy();
        }
      });

      const beforePipingTime = Date.now();
      console.log(`[${beforePipingTime}] TTS: Starting to pipe audio stream to client. Time since request: ${beforePipingTime - requestReceivedTime}ms`);
      nodeStream.pipe(rawRes)
        .on('finish', () => {
          console.log(`[${Date.now()}] TTS: Audio stream finished piping to response.`);
        })
        .on('error', (error) => {
          console.error(`[${Date.now()}] TTS: Error piping audio stream to response:`, error);
          if (!rawRes.destroyed) {
            console.log(`[${Date.now()}] TTS: Piping error, attempting to destroy raw response.`);
            rawRes.destroy();
          }
        });

    } catch (error) {
      console.error(`[${Date.now()}] TTS: Error in TTS endpoint:`, error);
      if (error instanceof z.ZodError) {
        if (!res.sent) {
          res.status(HttpStatus.BAD_REQUEST).send({ error: 'Invalid request data' });
        } else {
          console.error(`[${Date.now()}] TTS: ZodError after headers sent. Cannot send new HTTP status.`);
        }
        return;
      }
      if (!res.sent) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ error: 'Internal server error' });
      } else {
        console.error(`[${Date.now()}] TTS: Error in TTS endpoint after headers sent. Cannot send new HTTP status.`);
        if (!res.raw.destroyed) {
            res.raw.destroy();
        }
      }
    }
  }
} 