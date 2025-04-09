import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  Comment,
  InsertableComment,
  UpdatableComment,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithPagination, PaginationResult } from '@docmost/db/pagination/pagination';
import { ExpressionBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { jsonObjectFrom } from 'kysely/helpers/postgres';

@Injectable()
export class CommentRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    commentId: string,
    opts?: { includeCreator: boolean },
  ): Promise<Comment | undefined> {
    let query = this.db
      .selectFrom('comments')
      .selectAll('comments')
      .where('id', '=', commentId);

    if (opts?.includeCreator) {
      query = query.select((eb) => this.withCreator(eb));
    }
    return await query.executeTakeFirst(); 
  }

  async findPageComments(pageId: string, pagination: PaginationOptions): Promise<PaginationResult<Comment>> {
    let query = this.db
      .selectFrom('comments')
      .selectAll('comments')
      .select((eb) => this.withCreator(eb))
      .where('pageId', '=', pageId)
      .orderBy('createdAt', 'asc');

    const result = await executeWithPagination<Comment, DB, 'comments'>(query, {
      page: pagination.page,
      perPage: pagination.limit,
    });

    return result;
  }

  async updateComment(
    updatableComment: UpdatableComment,
    commentId: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    const valuesToUpdate: Record<string, any> = { ...updatableComment };
    if (valuesToUpdate.suggestions && typeof valuesToUpdate.suggestions !== 'string') {
        valuesToUpdate.suggestions = JSON.stringify(valuesToUpdate.suggestions);
    }
    await db
      .updateTable('comments')
      .set(valuesToUpdate)
      .where('id', '=', commentId)
      .execute();
  }

  async insertComment(
    insertableComment: InsertableComment,
    trx?: KyselyTransaction,
  ): Promise<Comment> {
    const db = dbOrTx(this.db, trx);

    const valuesToInsert: Record<string, any> = { ...insertableComment };
    if (valuesToInsert.suggestions && typeof valuesToInsert.suggestions !== 'string') {
        valuesToInsert.suggestions = JSON.stringify(valuesToInsert.suggestions);
    }

    return db
      .insertInto('comments')
      .values(valuesToInsert)
      .returningAll()
      .executeTakeFirst();
  }

  withCreator(eb: ExpressionBuilder<DB, 'comments'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'comments.creatorId'),
    ).as('creator');
  }

  async deleteComment(commentId: string): Promise<void> {
    await this.db.deleteFrom('comments').where('id', '=', commentId).execute();
  }

  async resolveComment(commentId: string): Promise<void> {
    await this.db
      .updateTable('comments')
      .set({ resolvedAt: new Date() })
      .where('id', '=', commentId)
      .execute();
  }

  async unresolveComment(commentId: string): Promise<void> {
    await this.db
      .updateTable('comments')
      .set({ resolvedAt: null })
      .where('id', '=', commentId)
      .execute();
  }
}
