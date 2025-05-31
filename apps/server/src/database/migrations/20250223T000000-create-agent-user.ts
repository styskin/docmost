import { Kysely, sql } from 'kysely';
import { hashPassword } from '../../common/helpers';
import { UserRole } from '../../common/helpers/types/permission';
import { AGENT_USER_ID } from '../../common/helpers/constants';

export async function up(db: Kysely<any>): Promise<void> {
  // Check if any workspaces exist (DB is initialized)
  const anyWorkspace = await db
    .selectFrom('workspaces')
    .select('id')
    .limit(1)
    .executeTakeFirst();

  if (!anyWorkspace) {
    console.log(
      'No workspaces exist, database is not initialized. Skipping Agent user creation.',
    );
    return;
  }

  // Check if Agent user already exists
  const existingAgentUser = await db
    .selectFrom('users')
    .where('id', '=', AGENT_USER_ID)
    .select('id')
    .executeTakeFirst();

  if (existingAgentUser) {
    console.log('Agent user already exists, skipping creation');
    return;
  }

  // Create agent workspace
  const workspace = await db
    .insertInto('workspaces')
    .values({
      id: AGENT_USER_ID, // Use the same ID for workspace and user
      name: 'Agent Workspace',
      default_role: UserRole.ADMIN,
    })
    .onConflict((oc) => oc.doNothing())
    .returning('id')
    .executeTakeFirst();

  if (!workspace) {
    console.log('Workspace already exists or creation failed');
    return;
  }

  // Create agent user
  const agentUser = await db
    .insertInto('users')
    .values({
      id: AGENT_USER_ID,
      name: 'Agent',
      email: 'agent@docmost.local',
      password: await hashPassword('AgentPassword123!'),
      role: UserRole.ADMIN,
      workspace_id: workspace.id,
      locale: 'en-US',
      last_login_at: new Date(),
    })
    .onConflict((oc) => oc.doNothing())
    .returning('id')
    .executeTakeFirst();

  if (!agentUser) {
    console.log('Agent user already exists or creation failed');
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  // Delete agent user
  await db.deleteFrom('users').where('id', '=', AGENT_USER_ID).execute();

  // Delete agent workspace
  await db.deleteFrom('workspaces').where('id', '=', AGENT_USER_ID).execute();
}
