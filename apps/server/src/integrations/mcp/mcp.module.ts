import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { DatabaseModule } from '@docmost/db/database.module';
import { DocumentModule } from '../../core/document/document.module';

@Module({
  imports: [DatabaseModule, DocumentModule],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
