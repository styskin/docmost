import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { DatabaseModule } from '@docmost/db/database.module';
import {
  CreateDocumentTool,
  AppendDocumentTool,
  ListDocumentsTool,
  GetDocumentTool,
  ListSpacesTool,
  ListWorkspacesTool,
  SuggestDiffTool,
} from './tools';
import { WsModule } from '../../ws/ws.module';

@Module({
  imports: [DatabaseModule, WsModule],
  controllers: [McpController],
  providers: [
    McpService,
    CreateDocumentTool,
    AppendDocumentTool,
    ListDocumentsTool,
    GetDocumentTool,
    ListSpacesTool,
    ListWorkspacesTool,
    SuggestDiffTool,
  ],
  exports: [McpService],
})
export class McpModule {}
