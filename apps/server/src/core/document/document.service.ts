import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { GetDocumentDto } from './dto/get-document.dto';
import { generateSlugId } from '../../common/helpers';
import { AGENT_USER_ID } from '../../common/helpers/constants';
import { Page } from '@docmost/db/types/entity.types';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly pageRepo: PageRepo,
    private readonly spaceRepo: SpaceRepo,
    private readonly workspaceRepo: WorkspaceRepo,
  ) {}

  async createDocument(dto: CreateDocumentDto): Promise<any> {
    try {
      const { title, content, spaceId } = dto;
      
      const workspaceEntity = await this.workspaceRepo.findFirst();
      const workspaceId = workspaceEntity?.id;
      const spaceEntity = await this.spaceRepo.findById(spaceId, workspaceId);
      
      if (!spaceEntity) {
        throw new NotFoundException(`Space with ID "${spaceId}" not found`);
      }

      const createdPage = await this.pageRepo.insertPage({
        slugId: generateSlugId(),
        title,
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }] },
        textContent: content,
        position: '0',
        spaceId: spaceEntity.id,
        workspaceId: workspaceId,
        creatorId: AGENT_USER_ID,
        lastUpdatedById: AGENT_USER_ID,
      });

      this.logger.log(`Created document with title: ${title} and ID: ${createdPage.id}`);
      
      return {
        documentId: createdPage.id,
        slugId: createdPage.slugId,
        title: createdPage.title,
        message: 'Document created successfully'
      };
    } catch (error: any) {
      this.logger.error(`Failed to create document: ${error.message}`, error.stack);
      throw error;
    }
  }

  async listDocuments(dto: ListDocumentsDto): Promise<any[]> {
    try {
      const { space } = dto;
      
      const workspaceEntity = await this.workspaceRepo.findFirst();
      const workspaceId = workspaceEntity?.id;

      const spaceEntity = await this.spaceRepo.findBySlug(space, workspaceId);
      if (!spaceEntity) {
        throw new NotFoundException(`Space "${space}" not found`);
      }

      const paginationResult = await this.pageRepo.getRecentPagesInSpace(
        spaceEntity.id,
        { page: 1, limit: 1000, query: undefined },
      );
      const documents = paginationResult.items;

      const documentList = documents.map((doc) => ({
        id: doc.id,
        slugId: doc.slugId,
        title: doc.title,
        position: doc.position,
        parentId: doc.parentPageId,
      }));

      this.logger.log(`Listed ${documentList.length} documents in space: ${space}`);
      return documentList;
    } catch (error: any) {
      this.logger.error(`Failed to list documents in space: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getDocument(dto: GetDocumentDto): Promise<Page> {
    try {
      const { slugId } = dto;
      
      const document = await this.pageRepo.findById(slugId, { includeContent: true });

      if (!document) {
        throw new NotFoundException(`Document with slug ID "${slugId}" not found`);
      }

      this.logger.log(`Retrieved document with slug ID: ${slugId}`);
      return document;
    } catch (error: any) {
      this.logger.error(`Failed to get document by slug ID: ${error.message}`, error.stack);
      throw error;
    }
  }
}
