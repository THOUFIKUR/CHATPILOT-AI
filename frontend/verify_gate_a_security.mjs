import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

async function verifyGateASecurity() {
  console.log('===============================================================');
  console.log('   CHATPILOT AI — GATE A PRE-PRODUCTION SECURITY VERIFICATION   ');
  console.log('===============================================================\n');

  // --- 1. VERIFY FILE CHECKSUMS FIRST ---
  console.log('>>> SECTION 3: MIGRATION & ROLLBACK INTEGRITY CHECKS');
  const migrationPath = path.resolve('..', 'supabase_extension.sql');
  const rollbackPath = path.resolve('..', 'supabase_rollback.sql');

  const migrationBytes = fs.readFileSync(migrationPath);
  const rollbackBytes = fs.readFileSync(rollbackPath);

  const migrationSha = crypto.createHash('sha256').update(migrationBytes).digest('hex');
  const rollbackSha = crypto.createHash('sha256').update(rollbackBytes).digest('hex');

  const EXPECTED_MIGRATION_SHA = 'db48e2f2817aa96a8eeeffb9ab534096cfff2b335bbbd81a9b6d565a5ab0f3f2';
  const EXPECTED_MIGRATION_SIZE = 15269;
  const EXPECTED_ROLLBACK_SHA = 'eb33c00e6a45e1af7f0090d8d94bf509a3ad0e86d70bd7b2b07925bbf49e2903';

  console.log(`Migration File: ${migrationPath}`);
  console.log(`  Size: ${migrationBytes.length} bytes (Expected: ${EXPECTED_MIGRATION_SIZE})`);
  console.log(`  SHA-256: ${migrationSha}`);
  console.log(`  Checksum Match: ${migrationSha === EXPECTED_MIGRATION_SHA ? 'MATCH' : 'MISMATCH'}`);
  console.log(`  Size Match: ${migrationBytes.length === EXPECTED_MIGRATION_SIZE ? 'MATCH' : 'MISMATCH'}`);

  console.log(`\nRollback File: ${rollbackPath}`);
  console.log(`  Size: ${rollbackBytes.length} bytes`);
  console.log(`  SHA-256: ${rollbackSha}`);
  console.log(`  Checksum Match: ${rollbackSha === EXPECTED_ROLLBACK_SHA ? 'MATCH' : 'MISMATCH'}`);

  if (migrationSha !== EXPECTED_MIGRATION_SHA || migrationBytes.length !== EXPECTED_MIGRATION_SIZE) {
    throw new Error('Migration file integrity check failed!');
  }
  if (rollbackSha !== EXPECTED_ROLLBACK_SHA) {
    throw new Error('Rollback file integrity check failed!');
  }

  // --- 2. SETUP ISOLATED POSTGRESQL ENGINE ---
  console.log('\n>>> PROVISIONING ISOLATED POSTGRESQL 19/16 ENGINE...');
  const db = new PGlite();
  const vRes = await db.query('SELECT version();');
  console.log(`PostgreSQL Engine Online: ${vRes.rows[0].version}`);

  // Setup auth schema, auth.users, and auth.uid() function mimicking Supabase
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text
    );
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$ LANGUAGE sql STABLE;

    -- Roles for Supabase privilege hierarchy
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
      END IF;
    END $$;
  `);

  // Create core tables
  const coreSchemaSql = fs.readFileSync(path.resolve('..', 'backup_core_schema_20261125.sql'), 'utf-8');
  await db.exec(coreSchemaSql);

  // Execute migration
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  await db.exec(migrationSql);
  console.log('Applied supabase_extension.sql in isolated PostgreSQL.');

  const extensionTables = [
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

  // --- 3. PRIVILEGE AUDIT (SECTION 2) ---
  console.log('\n>>> SECTION 2: EFFECTIVE POSTGRESQL PRIVILEGES AUDIT');
  const roles = ['public', 'anon', 'authenticated', 'service_role'];
  const operations = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
  let allPrivilegesPass = true;

  console.log('Inspecting has_table_privilege for all 9 extension tables:');
  console.log('-----------------------------------------------------------------------------');
  console.log('Table Name                  | anon / public      | authenticated   | service_role');
  console.log('-----------------------------------------------------------------------------');

  for (const tbl of extensionTables) {
    let anonCanAny = false;
    let authCanAll = true;
    let servCanAll = true;

    for (const op of operations) {
      const anonRes = await db.query(`SELECT has_table_privilege('anon', 'public.${tbl}', '${op}') as allowed;`);
      const pubRes = await db.query(`SELECT has_table_privilege('public', 'public.${tbl}', '${op}') as allowed;`);
      if (anonRes.rows[0].allowed || pubRes.rows[0].allowed) anonCanAny = true;

      const authRes = await db.query(`SELECT has_table_privilege('authenticated', 'public.${tbl}', '${op}') as allowed;`);
      if (!authRes.rows[0].allowed) authCanAll = false;

      const servRes = await db.query(`SELECT has_table_privilege('service_role', 'public.${tbl}', '${op}') as allowed;`);
      if (!servRes.rows[0].allowed) servCanAll = false;
    }

    const anonStatus = anonCanAny ? 'FAIL (Allowed)' : 'PASS (Revoked)';
    const authStatus = authCanAll ? 'PASS (CRUD)' : 'FAIL (Missing)';
    const servStatus = servCanAll ? 'PASS (ALL)' : 'FAIL (Missing)';

    if (anonCanAny || !authCanAll || !servCanAll) allPrivilegesPass = false;

    console.log(`${tbl.padEnd(27)} | ${anonStatus.padEnd(18)} | ${authStatus.padEnd(15)} | ${servStatus}`);
  }
  console.log('-----------------------------------------------------------------------------');
  console.log(`Privilege Audit Overall: ${allPrivilegesPass ? 'PASS' : 'FAIL'}`);

  // --- 4. ACTUAL RLS ENFORCEMENT TESTS (SECTION 1) ---
  console.log('\n>>> SECTION 1: ACTUAL RLS ENFORCEMENT TESTS (ALICE vs BOB)');
  
  // Setup Alice and Bob
  const aliceId = '11111111-1111-1111-1111-111111111111';
  const bobId = '22222222-2222-2222-2222-222222222222';
  await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2), ($3, $4);`,
    [aliceId, 'alice@test.local', bobId, 'bob@test.local']);

  // As service_role/admin, populate baseline contacts and messages for foreign keys
  await db.exec(`
    INSERT INTO public.contacts (id, owner_id, display_name) VALUES 
      ('c0000000-0000-0000-0000-000000000001', '${aliceId}', 'Alice Contact'),
      ('c0000000-0000-0000-0000-000000000002', '${bobId}', 'Bob Contact');

    INSERT INTO public.conversations (id, owner_id, conversation_type, contact_id) VALUES 
      ('b0000000-0000-0000-0000-000000000001', '${aliceId}', 'contact', 'c0000000-0000-0000-0000-000000000001'),
      ('b0000000-0000-0000-0000-000000000002', '${bobId}', 'contact', 'c0000000-0000-0000-0000-000000000002');

    INSERT INTO public.messages (id, owner_id, conversation_id, direction, body) VALUES 
      ('a0000000-0000-0000-0000-000000000001', '${aliceId}', 'b0000000-0000-0000-0000-000000000001', 'incoming', 'Alice Msg'),
      ('a0000000-0000-0000-0000-000000000002', '${bobId}', 'b0000000-0000-0000-0000-000000000002', 'incoming', 'Bob Msg');

    INSERT INTO public.reply_drafts (id, owner_id, conversation_id, draft_text) VALUES 
      ('d0000000-0000-0000-0000-000000000001', '${aliceId}', 'b0000000-0000-0000-0000-000000000001', 'Alice Draft'),
      ('d0000000-0000-0000-0000-000000000002', '${bobId}', 'b0000000-0000-0000-0000-000000000002', 'Bob Draft');
  `);

  // Helper to switch simulated authenticated context
  async function asUser(userId, fn) {
    await db.exec(`SET ROLE authenticated;`);
    await db.exec(`SET request.jwt.claim.sub = '${userId}';`);
    try {
      return await fn();
    } finally {
      await db.exec(`RESET ROLE;`);
      await db.exec(`RESET request.jwt.claim.sub;`);
    }
  }

  const rlsResults = [];

  // Table-by-table tests
  // 1. chat_import_batches
  await asUser(aliceId, async () => {
    // INSERT legitimate
    const ins = await db.query(`INSERT INTO public.chat_import_batches (id, owner_id, batch_name) VALUES ('b1111111-1111-1111-1111-111111111111', '${aliceId}', 'Alice Batch') RETURNING id;`);
    rlsResults.push({ table: 'chat_import_batches', op: 'INSERT (Legitimate)', pass: ins.rows.length === 1 });

    // INSERT impersonation attempt (Alice tries to insert record owned by Bob)
    let insSpoofFailed = false;
    try {
      await db.query(`INSERT INTO public.chat_import_batches (owner_id, batch_name) VALUES ('${bobId}', 'Spoofed Batch');`);
    } catch (err) {
      insSpoofFailed = err.code === '42501'; // new row violates row-level security policy
    }
    rlsResults.push({ table: 'chat_import_batches', op: 'INSERT (Spoof owner_id Rejected)', pass: insSpoofFailed });
  });

  await asUser(bobId, async () => {
    // Bob inserts his own batch
    await db.query(`INSERT INTO public.chat_import_batches (id, owner_id, batch_name) VALUES ('b2222222-2222-2222-2222-222222222222', '${bobId}', 'Bob Batch');`);

    // Bob tries to SELECT Alice batch
    const selAlice = await db.query(`SELECT * FROM public.chat_import_batches WHERE id = 'b1111111-1111-1111-1111-111111111111';`);
    rlsResults.push({ table: 'chat_import_batches', op: 'SELECT (Cross-owner Isolation)', pass: selAlice.rows.length === 0 });

    // Bob tries to UPDATE Alice batch
    const updAlice = await db.query(`UPDATE public.chat_import_batches SET batch_name = 'Hacked' WHERE id = 'b1111111-1111-1111-1111-111111111111';`);
    rlsResults.push({ table: 'chat_import_batches', op: 'UPDATE (Cross-owner 0 rows)', pass: updAlice.affectedRows === 0 });

    // Bob tries to change his own record owner_id to Alice (WITH CHECK enforcement)
    let reassignFailed = false;
    try {
      await db.query(`UPDATE public.chat_import_batches SET owner_id = '${aliceId}' WHERE id = 'b2222222-2222-2222-2222-222222222222';`);
    } catch (err) {
      reassignFailed = err.code === '42501'; // new row violates row-level security policy for update
    }
    rlsResults.push({ table: 'chat_import_batches', op: 'UPDATE (owner_id Reassignment Rejected)', pass: reassignFailed });

    // Bob tries to DELETE Alice batch
    const delAlice = await db.query(`DELETE FROM public.chat_import_batches WHERE id = 'b1111111-1111-1111-1111-111111111111';`);
    rlsResults.push({ table: 'chat_import_batches', op: 'DELETE (Cross-owner 0 rows)', pass: delAlice.affectedRows === 0 });
  });

  // 2. assistant_sessions & assistant_session_messages
  await asUser(aliceId, async () => {
    await db.query(`INSERT INTO public.assistant_sessions (id, owner_id, title) VALUES ('e1111111-1111-1111-1111-111111111111', '${aliceId}', 'Alice Session');`);
    await db.query(`INSERT INTO public.assistant_session_messages (id, owner_id, session_id, role, content) VALUES ('a1111111-1111-1111-1111-111111111111', '${aliceId}', 'e1111111-1111-1111-1111-111111111111', 'user', 'Alice Secret');`);
  });

  await asUser(bobId, async () => {
    // Bob SELECT Alice assistant messages
    const selMsg = await db.query(`SELECT * FROM public.assistant_session_messages WHERE session_id = 'e1111111-1111-1111-1111-111111111111';`);
    rlsResults.push({ table: 'assistant_session_messages', op: 'SELECT (Cross-owner Isolation)', pass: selMsg.rows.length === 0 });

    // Bob UPDATE Alice assistant messages
    const updMsg = await db.query(`UPDATE public.assistant_session_messages SET content = 'Compromised' WHERE id = 'a1111111-1111-1111-1111-111111111111';`);
    rlsResults.push({ table: 'assistant_session_messages', op: 'UPDATE (Cross-owner 0 rows)', pass: updMsg.affectedRows === 0 });

    // Bob DELETE Alice assistant message
    const delMsg = await db.query(`DELETE FROM public.assistant_session_messages WHERE id = 'a1111111-1111-1111-1111-111111111111';`);
    rlsResults.push({ table: 'assistant_session_messages', op: 'DELETE (Cross-owner 0 rows)', pass: delMsg.affectedRows === 0 });
  });

  // 3. Testing Remaining 6 Extension Tables (Style Profiles, Relationships, Policies, Attachments, Feedback, Sources)
  await asUser(aliceId, async () => {
    await db.query(`INSERT INTO public.chat_import_sources (id, owner_id, batch_id, source_filename, source_sha256) VALUES ('c1111111-1111-1111-1111-111111111111', '${aliceId}', 'b1111111-1111-1111-1111-111111111111', 'alice.txt', 'h1');`);
    await db.query(`INSERT INTO public.contact_style_profiles (id, owner_id, contact_id) VALUES ('c2222222-1111-1111-1111-111111111111', '${aliceId}', 'c0000000-0000-0000-0000-000000000001');`);
    await db.query(`INSERT INTO public.contact_relationships (id, owner_id, contact_id, relationship_type) VALUES ('c3333333-1111-1111-1111-111111111111', '${aliceId}', 'c0000000-0000-0000-0000-000000000001', 'friend');`);
    await db.query(`INSERT INTO public.response_policies (id, owner_id, scope, message_category) VALUES ('c4444444-1111-1111-1111-111111111111', '${aliceId}', 'global', 'casual');`);
    await db.query(`INSERT INTO public.message_attachments (id, owner_id, message_id, attachment_type) VALUES ('c5555555-1111-1111-1111-111111111111', '${aliceId}', 'a0000000-0000-0000-0000-000000000001', 'document');`);
    await db.query(`INSERT INTO public.response_feedback (id, owner_id, reply_draft_id, action_taken) VALUES ('fb111111-1111-1111-1111-111111111111', '${aliceId}', 'd0000000-0000-0000-0000-000000000001', 'sent_as_is');`);
  });

  const remainingTables = [
    'chat_import_sources',
    'contact_style_profiles',
    'contact_relationships',
    'response_policies',
    'message_attachments',
    'response_feedback'
  ];

  await asUser(bobId, async () => {
    for (const t of remainingTables) {
      const sel = await db.query(`SELECT * FROM public.${t} WHERE owner_id = '${aliceId}';`);
      rlsResults.push({ table: t, op: 'SELECT (Cross-owner Isolation)', pass: sel.rows.length === 0 });

      const upd = await db.query(`UPDATE public.${t} SET owner_id = '${bobId}' WHERE owner_id = '${aliceId}';`);
      rlsResults.push({ table: t, op: 'UPDATE (Cross-owner 0 rows affected)', pass: upd.affectedRows === 0 });

      const del = await db.query(`DELETE FROM public.${t} WHERE owner_id = '${aliceId}';`);
      rlsResults.push({ table: t, op: 'DELETE (Cross-owner 0 rows affected)', pass: del.affectedRows === 0 });
    }
  });

  console.log('\nRLS TEST EXECUTION SUMMARY:');
  console.log('-----------------------------------------------------------------------------');
  console.log('Table Name                  | Operation Tested                    | Result   ');
  console.log('-----------------------------------------------------------------------------');
  let allRlsPass = true;
  for (const r of rlsResults) {
    if (!r.pass) allRlsPass = false;
    console.log(`${r.table.padEnd(27)} | ${r.op.padEnd(35)} | ${r.pass ? 'PASS' : 'FAIL'}`);
  }
  console.log('-----------------------------------------------------------------------------');
  console.log(`RLS Actual Enforcement Suite: ${allRlsPass ? 'PASS' : 'FAIL'}`);

  console.log('\n===============================================================');
  console.log('                 SECURITY VERIFICATION COMPLETE                ');
  console.log('===============================================================');
}

verifyGateASecurity().catch(err => {
  console.error('\nSECURITY VERIFICATION FAILED:', err);
  process.exit(1);
});
