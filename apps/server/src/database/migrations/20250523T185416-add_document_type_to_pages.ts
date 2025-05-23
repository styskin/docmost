import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('pages')
    .addColumn('type', 'text', (col) => col.defaultTo('standard'))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('pages').dropColumn('type').execute();
}
