import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { DatabaseModule } from '@docmost/db/database.module';
import {
  CreateDocumentTool,
  ListDocumentsTool,
  GetDocumentTool,
  ListSpacesTool,
  ListWorkspacesTool,
  SuggestDiffTool,
} from './tools';

@Module({
  imports: [DatabaseModule],
  controllers: [McpController],
  providers: [
    McpService,
    CreateDocumentTool,
    ListDocumentsTool,
    GetDocumentTool,
    ListSpacesTool,
    ListWorkspacesTool,
    SuggestDiffTool,
  ],
  exports: [McpService],
})
export class McpModule {}
