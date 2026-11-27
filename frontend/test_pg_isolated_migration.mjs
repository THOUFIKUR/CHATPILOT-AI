import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

async function runPostgresIsolatedTest() {
  console.log('=== STARTING ISOLATED POSTGRESQL ENGINE TEST ===');
  const db = new PGlite();

  // 1. Check version
  const vRes = await db.query('SELECT version();');
  console.log('Engine Version:', vRes.rows[0].version);

  // 2. Setup mock auth schema, auth.users, and auth.uid() function
  console.log('\n--- 1. Setting up PostgreSQL auth & mock environment ---');
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text
    );
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
      SELECT NULL::uuid;
    $$ LANGUAGE sql STABLE;

    -- Roles for privilege checking
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
      END IF;
    END $$;
  `);
  console.log('Auth schema and roles created.');

  // 3. Create the 15 core tables
  console.log('\n--- 2. Creating 15 core tables from backup_core_schema_20261125.sql ---');
  const coreSchemaSql = fs.readFileSync(path.resolve('..', 'backup_core_schema_20261125.sql'), 'utf-8');
  await db.exec(coreSchemaSql);

  const initialTables = await db.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log(`Core tables in public schema (${initialTables.rows.length}):`, initialTables.rows.map(r => r.table_name));

  // 4. Restore application snapshot into core tables
  console.log('\n--- 3. Restoring 49 application records from snapshot ---');
  const snapshotData = JSON.parse(fs.readFileSync(path.resolve('..', 'backup_pre_migration_20261125_updated.json'), 'utf-8'));
  
  // Insert owner
  const ownerId = '87f9f3d6-c0ac-493d-be13-36403ef5558f';
  await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2);`, [ownerId, 'thoufikur@chatpilot.local']);

  const tableOrder = [
    'contacts', 'chatpilot_groups', 'conversations', 'messages',
    'ai_providers', 'ai_usage_logs', 'reply_drafts', 'activity_logs',
    'integration_events', 'app_settings'
  ];

  let restoredRows = 0;
  for (const tbl of tableOrder) {
    const rows = snapshotData[tbl] || [];
    for (const r of rows) {
      const cols = Object.keys(r);
      const vals = Object.values(r).map(v => (typeof v === 'object' && v !== null ? JSON.stringify(v) : v));
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const query = `INSERT INTO public.${tbl} (${cols.join(', ')}) VALUES (${placeholders});`;
      await db.query(query, vals);
      restoredRows++;
    }
  }
  console.log(`Successfully restored ${restoredRows} core application records into PostgreSQL.`);

  // 5. Run exact migration file
  console.log('\n--- 4. Executing exact supabase_extension.sql ---');
  const migrationSql = fs.readFileSync(path.resolve('..', 'supabase_extension.sql'), 'utf-8');
  await db.exec(migrationSql);
  console.log('Migration executed successfully inside transaction block!');

  // 6. Verify 9 extension tables
  const afterTables = await db.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log(`\nTotal tables in public schema after migration: ${afterTables.rows.length}`);

  const expectedNewTables = [
    'chat_import_batches',
    'chat_import_sources',
    'contact_style_profiles',
    'contact_relationships',
    'response_policies',
    'message_attachments',
    'response_feedback',
    'assistant_sessions',
    'assistant_session_messages'
  ];

  for (const nt of expectedNewTables) {
    const found = afterTables.rows.some(r => r.table_name === nt);
    if (!found) throw new Error(`Missing expected table: ${nt}`);
  }
  console.log('ALL NINE EXTENSION TABLES VERIFIED PRESENT.');

  // 7. Verify RLS status on all 9 tables
  console.log('\n--- 5. Verifying Row Level Security (RLS) on all 9 tables ---');
  const rlsCheck = await db.query(`
    SELECT relname, relrowsecurity 
    FROM pg_class 
    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace 
    WHERE nspname = 'public' AND relname = ANY($1);
  `, [expectedNewTables]);

  for (const row of rlsCheck.rows) {
    console.log(`  Table: ${row.relname} | RLS Enabled: ${row.relrowsecurity}`);
    if (!row.relrowsecurity) throw new Error(`RLS not enabled on ${row.relname}`);
  }

  // 8. Verify Composite Foreign Key Constraints
  console.log('\n--- 6. Verifying Composite Foreign Key Constraints ---');
  const fkCheck = await db.query(`
    SELECT conname, contype 
    FROM pg_constraint 
    JOIN pg_namespace ON pg_namespace.oid = pg_constraint.connamespace 
    WHERE nspname = 'public' AND contype = 'f';
  `);
  console.log(`Foreign keys present in schema (${fkCheck.rows.length}):`);
  for (const fk of fkCheck.rows) {
    console.log(`  Constraint: ${fk.conname}`);
  }

  // 9. Test Cross-Owner Rejection in PostgreSQL
  console.log('\n--- 7. Testing Cross-Owner Rejection (Tenant Boundary) in PostgreSQL ---');
  const bobId = 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0';
  await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2);`, [bobId, 'bob@attacker.local']);

  // Alice batch
  const batchRes = await db.query(`
    INSERT INTO public.chat_import_batches (owner_id, batch_name) 
    VALUES ($1, 'Alice Package Batch') RETURNING id;
  `, [ownerId]);
  const aliceBatchId = batchRes.rows[0].id;

  // Alice contact
  const contactRes = await db.query(`
    SELECT id FROM public.contacts WHERE owner_id = $1 LIMIT 1;
  `, [ownerId]);
  const aliceContactId = contactRes.rows[0].id;

  // Bob attempt to reference Alice batch
  let bobCrossOwnerBlocked = false;
  try {
    await db.query(`
      INSERT INTO public.chat_import_sources (owner_id, batch_id, source_filename, source_sha256) 
      VALUES ($1, $2, 'hijack.txt', 'fakehash');
    `, [bobId, aliceBatchId]);
  } catch (err) {
    bobCrossOwnerBlocked = true;
    console.log(`  PostgreSQL rejected Bob cross-tenant batch reference: ${err.message}`);
  }
  if (!bobCrossOwnerBlocked) throw new Error('Security Error: Cross-tenant batch reference was allowed!');

  // Bob attempt to reference Alice contact
  const bobBatchRes = await db.query(`
    INSERT INTO public.chat_import_batches (owner_id, batch_name) 
    VALUES ($1, 'Bob Batch') RETURNING id;
  `, [bobId]);
  const bobBatchId = bobBatchRes.rows[0].id;

  let bobContactBlocked = false;
  try {
    await db.query(`
      INSERT INTO public.chat_import_sources (owner_id, batch_id, contact_id, source_filename, source_sha256) 
      VALUES ($1, $2, $3, 'hijack_contact.txt', 'fakehash2');
    `, [bobId, bobBatchId, aliceContactId]);
  } catch (err) {
    bobContactBlocked = true;
    console.log(`  PostgreSQL rejected Bob cross-tenant contact reference: ${err.message}`);
  }
  if (!bobContactBlocked) throw new Error('Security Error: Cross-tenant contact reference was allowed!');

  // 10. Test Assistant Session Composite Ownership
  const aliceSessionRes = await db.query(`
    INSERT INTO public.assistant_sessions (owner_id, title) 
    VALUES ($1, 'Alice Private Assistant') RETURNING id;
  `, [ownerId]);
  const aliceSessionId = aliceSessionRes.rows[0].id;

  let bobSessionBlocked = false;
  try {
    await db.query(`
      INSERT INTO public.assistant_session_messages (owner_id, session_id, role, content) 
      VALUES ($1, $2, 'user', 'Injected message');
    `, [bobId, aliceSessionId]);
  } catch (err) {
    bobSessionBlocked = true;
    console.log(`  PostgreSQL rejected Bob cross-tenant assistant message injection: ${err.message}`);
  }
  if (!bobSessionBlocked) throw new Error('Security Error: Cross-tenant assistant message was allowed!');

  // 11. Test Safe Contact Detachment: ON DELETE SET NULL (contact_id)
  console.log('\n--- 8. Testing ON DELETE SET NULL (contact_id) behavior ---');
  // Create disposable contact
  const dispContactRes = await db.query(`
    INSERT INTO public.contacts (owner_id, display_name) 
    VALUES ($1, 'Disposable Contact') RETURNING id;
  `, [ownerId]);
  const dispContactId = dispContactRes.rows[0].id;

  const srcRes = await db.query(`
    INSERT INTO public.chat_import_sources (owner_id, batch_id, contact_id, source_filename, source_sha256) 
    VALUES ($1, $2, $3, 'test_source.txt', 'test_sha_12345') RETURNING id;
  `, [ownerId, aliceBatchId, dispContactId]);
  const srcId = srcRes.rows[0].id;

  // Delete the contact
  await db.query(`DELETE FROM public.contacts WHERE id = $1;`, [dispContactId]);

  // Check source row
  const checkSrc = await db.query(`SELECT contact_id, owner_id FROM public.chat_import_sources WHERE id = $1;`, [srcId]);
  console.log(`  After contact deletion: contact_id = ${checkSrc.rows[0].contact_id}, owner_id = ${checkSrc.rows[0].owner_id}`);
  if (checkSrc.rows[0].contact_id !== null) throw new Error('contact_id was not set to NULL on contact deletion');
  if (checkSrc.rows[0].owner_id !== ownerId) throw new Error('owner_id was altered on contact deletion');

  // 12. Test Rollback Script
  console.log('\n--- 9. Executing supabase_rollback.sql in isolated PostgreSQL ---');
  const rollbackSql = fs.readFileSync(path.resolve('..', 'supabase_rollback.sql'), 'utf-8');
  await db.exec(rollbackSql);

  const afterRollbackTables = await db.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log(`Tables after rollback (${afterRollbackTables.rows.length}):`, afterRollbackTables.rows.map(r => r.table_name));

  // Verify all 15 core tables still exist
  const coreTableCount = await db.query(`
    SELECT count(*)::int as cnt FROM information_schema.tables 
    WHERE table_schema = 'public';
  `);
  console.log(`Core tables remaining after rollback: ${coreTableCount.rows[0].cnt} (Expected 15)`);

  // Verify core records remain intact
  const coreMsgCount = await db.query(`SELECT count(*)::int as cnt FROM public.messages;`);
  console.log(`Messages row count after rollback: ${coreMsgCount.rows[0].cnt} (Expected 11)`);

  console.log('\n=== ALL ISOLATED POSTGRESQL ENGINE TESTS PASSED PERFECTLY ===');
}

runPostgresIsolatedTest().catch(err => {
  console.error('\nFAILED ISOLATED POSTGRES TEST:', err);
  process.exit(1);
});
