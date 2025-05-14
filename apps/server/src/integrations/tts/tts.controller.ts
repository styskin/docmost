import {
  Controller,
  Post,
  Body,
  Res,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import OpenAI from 'openai';
import { Readable } from 'stream';
import { IsString, IsNotEmpty } from 'class-validator';

// Basic DTO for request body validation
class TtsRequestDto {
  @IsString()
  @IsNotEmpty()
  text: string;
}

@Controller('tts')
export class TtsController {
  private openai: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY is not set. TTS endpoint will not work.');
    }
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  @Post()
  async generateSpeech(@Body() body: TtsRequestDto, @Res() res: Response) {
    console.log('TTS Controller: Received request body:', body);

    if (!this.openai.apiKey) {
      throw new HttpException(
        'TTS service is not configured due to missing OpenAI API key.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const { text } = body;
    console.log('TTS Controller: Extracted text:', text);

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.error(
        'TTS Controller: Manual validation failed even after DTO validation should have run.',
        { text },
      );
      throw new HttpException(
        'Invalid text input received.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const mp3 = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy',
        input: text,
        response_format: 'mp3',
      });

      // Set headers for audio streaming
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Transfer-Encoding', 'chunked');

      if (mp3.body instanceof Readable) {
        // Handle the stream manually instead of using pipe
        const chunks: Uint8Array[] = [];
        for await (const chunk of mp3.body) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
        res.send(buffer);
        res.end();
      } else {
        console.error('Unexpected stream type from OpenAI API');
        throw new HttpException(
          'Failed to process audio stream',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    } catch (error) {
      console.error('Error generating speech:', error);
      if (error instanceof OpenAI.APIError) {
        throw new HttpException(
          `OpenAI API error: ${error.message}`,
          error.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        'Failed to generate speech',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
