import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { DatabaseModule } from '@docmost/db/database.module';
import {
  CreateDocumentTool,
  AppendContentTool,
  ListDocumentsTool,
  GetDocumentTool,
  ListSpacesTool,
  ListWorkspacesTool,
  SuggestDiffTool,
} from './tools';
import { WsModule } from '../../ws/ws.module';
import { PageModule } from '../../core/page/page.module';

@Module({
  imports: [DatabaseModule, WsModule, PageModule],
  controllers: [McpController],
  providers: [
    McpService,
    CreateDocumentTool,
    AppendContentTool,
    ListDocumentsTool,
    GetDocumentTool,
    ListSpacesTool,
    ListWorkspacesTool,
    SuggestDiffTool,
  ],
  exports: [McpService],
})
export class McpModule {}
