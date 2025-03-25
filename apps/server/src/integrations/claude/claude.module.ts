import { Global, Module } from '@nestjs/common';
import { ClaudeController } from './claude.controller';

@Global()
@Module({
  controllers: [ClaudeController],
})
export class ClaudeModule {}
