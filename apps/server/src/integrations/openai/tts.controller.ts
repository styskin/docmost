import { Controller, Post, Body, Res, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { OpenAI } from 'openai';
import { z } from 'zod';

const ttsRequestSchema = z.object({
  text: z.string().min(1),
});

@Controller('openai')
export class TTSController {
  constructor(private readonly openai: OpenAI) {}

  @Post('tts')
  async textToSpeech(@Body('text') text: string, @Res() res: Response) {
    try {
      const { text: validatedText } = ttsRequestSchema.parse({ text });

      const mp3 = await this.openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: validatedText,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());

      // Set appropriate headers
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', buffer.length);

      // Send the audio data
      res.send(buffer);
    } catch (error) {
      console.error('Error in TTS endpoint:', error);
      if (error instanceof z.ZodError) {
        throw new HttpException('Invalid request data', HttpStatus.BAD_REQUEST);
      }
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
} 