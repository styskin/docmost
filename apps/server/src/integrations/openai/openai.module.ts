import { Module } from '@nestjs/common';
import { OpenAI } from 'openai';
import { TTSController } from './tts.controller';

@Module({
  controllers: [TTSController],
  providers: [
    {
      provide: OpenAI,
      useFactory: () => new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      }),
    },
  ],
  exports: [OpenAI],
})
export class OpenAIModule {} 