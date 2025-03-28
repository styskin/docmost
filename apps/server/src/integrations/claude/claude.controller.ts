import { Body, Controller, Post, Get } from '@nestjs/common';
import { Anthropic } from '@anthropic-ai/sdk';

@Controller('claude')
export class ClaudeController {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  @Get()
  async check() {
      return {"message" : "Hello!"};
  }
  @Post()
  async query(@Body() body: any) {
    console.debug('Received query:', body);
    try {
      const completion = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        messages: [{ role: 'user', content: JSON.stringify(body) }],
      });
      console.debug('Completion:', completion);
      return {
        response: completion.content[0].text,
      };
    } catch (error) {
      console.error('Claude API error:', error);
      throw error;
    }
  }
} 