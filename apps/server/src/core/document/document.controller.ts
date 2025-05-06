import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { DocumentService } from './document.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { GetDocumentDto } from './dto/get-document.dto';
import { ListDocumentsDto } from './dto/list-documents.dto';

@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createDocument(@Body() createDocumentDto: CreateDocumentDto) {
    return this.documentService.createDocument(createDocumentDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async listDocuments(@Query('space') space: string) {
    const listDocumentsDto = new ListDocumentsDto();
    listDocumentsDto.space = space;
    return this.documentService.listDocuments(listDocumentsDto);
  }

  @Get(':slugId')
  @HttpCode(HttpStatus.OK)
  async getDocument(@Param('slugId') slugId: string) {
    const getDocumentDto = new GetDocumentDto();
    getDocumentDto.slugId = slugId;
    return this.documentService.getDocument(getDocumentDto);
  }
}
