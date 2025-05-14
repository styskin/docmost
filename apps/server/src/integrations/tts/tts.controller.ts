import {
  Controller,
  Post,
  Body,
  Res,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
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
  async generateSpeech(@Body() body: TtsRequestDto, @Res() res: FastifyReply) {
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

      if (mp3.body instanceof Readable) {
        // Set headers and pipe the stream directly to Fastify response
        return res
          .header('Content-Type', 'audio/mpeg')
          .header('Cache-Control', 'no-cache')
          .send(mp3.body);
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
