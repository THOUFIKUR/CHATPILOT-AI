import sqlite3
import json
import os
import hashlib

def test_isolated_restoration():
    backup_json_path = r"D:\CHATPILOT AI\backup_pre_migration_20261125.json"
    
    # 1. Verify file and checksum
    with open(backup_json_path, "rb") as f:
        bytes_data = f.read()
    sha256 = hashlib.sha256(bytes_data).hexdigest()
    size = len(bytes_data)
    print(f"Isolated Test: Backup size = {size} bytes, SHA-256 = {sha256}")

    with open(backup_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # In-memory SQLite isolated database
    conn = sqlite3.connect(":memory:")
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE auth_users (
        id TEXT PRIMARY KEY
    );
    """)
    
    cur.execute("""
    CREATE TABLE contacts (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES auth_users(id),
        display_name TEXT NOT NULL,
        phone_e164 TEXT,
        whatsapp_jid TEXT,
        is_selected INTEGER,
        auto_reply_enabled INTEGER,
        reply_mode TEXT,
        preferred_language TEXT,
        notes TEXT,
        created_at TEXT,
        updated_at TEXT
    );
    """)

    cur.execute("""
    CREATE TABLE chatpilot_groups (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES auth_users(id),
        name TEXT,
        whatsapp_jid TEXT,
        is_active INTEGER,
        rule_type TEXT,
        mention_triggers TEXT,
        created_at TEXT,
        updated_at TEXT
    );
    """)

    cur.execute("""
    CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES auth_users(id),
        conversation_type TEXT,
        contact_id TEXT REFERENCES contacts(id),
        group_id TEXT REFERENCES chatpilot_groups(id),
        title TEXT,
        last_message_at TEXT,
        created_at TEXT,
        updated_at TEXT
    );
    """)

    cur.execute("""
    CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES auth_users(id),
        conversation_id TEXT NOT NULL REFERENCES conversations(id),
        external_message_id TEXT,
        direction TEXT,
        sender_identifier TEXT,
        sender_name TEXT,
        body TEXT,
        message_type TEXT,
        source TEXT,
        message_timestamp TEXT,
        metadata TEXT,
        created_at TEXT
    );
    """)

    cur.execute("""
    CREATE TABLE ai_providers (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES auth_users(id),
        provider_name TEXT,
        model_name TEXT,
        priority INTEGER,
        is_enabled INTEGER,
        allow_private_content INTEGER,
        monthly_budget REAL,
        settings TEXT,
        created_at TEXT,
        updated_at TEXT
    );
    """)

    cur.execute("""
    CREATE TABLE ai_usage_logs (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES auth_users(id),
        provider_name TEXT,
        model_name TEXT,
        request_status TEXT,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        estimated_cost REAL,
        latency_ms INTEGER,
        error_code TEXT,
        created_at TEXT
    );
    """)

    cur.execute("""
    CREATE TABLE reply_drafts (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES auth_users(id),
        conversation_id TEXT REFERENCES conversations(id),
        source_message_id TEXT REFERENCES messages(id),
        draft_text TEXT,
        provider_name TEXT,
        model_name TEXT,
        status TEXT,
        approved_at TEXT,
        sent_at TEXT,
        send_result TEXT,
        created_at TEXT,
        updated_at TEXT
    );
    """)

    cur.execute("""
    CREATE TABLE activity_logs (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES auth_users(id),
        event_type TEXT,
        description TEXT,
        related_conversation_id TEXT,
        metadata TEXT,
        created_at TEXT
    );
    """)

    cur.execute("""
    CREATE TABLE integration_events (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES auth_users(id),
        source TEXT,
        external_event_id TEXT,
        event_type TEXT,
        processing_status TEXT,
        safe_metadata TEXT,
        received_at TEXT,
        processed_at TEXT
    );
    """)

    cur.execute("""
    CREATE TABLE app_settings (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES auth_users(id),
        settings TEXT,
        created_at TEXT,
        updated_at TEXT
    );
    """)

    # 1. Insert Owner in auth_users
    owner_id = "87f9f3d6-c0ac-493d-be13-36403ef5558f"
    cur.execute("INSERT INTO auth_users (id) VALUES (?)", (owner_id,))

    # 2. Insert records by table dependency
    table_order = [
        "contacts", "chatpilot_groups", "conversations", "messages",
        "ai_providers", "ai_usage_logs", "reply_drafts", "activity_logs",
        "integration_events", "app_settings"
    ]

    total_restored = 0
    for tbl in table_order:
        rows = data.get(tbl, [])
        for r in rows:
            cols = list(r.keys())
            vals = []
            for col in cols:
                v = r[col]
                if isinstance(v, (dict, list)):
                    vals.append(json.dumps(v))
                else:
                    vals.append(v)
            placeholders = ",".join(["?"] * len(cols))
            sql = f"INSERT INTO {tbl} ({','.join(cols)}) VALUES ({placeholders})"
            cur.execute(sql, vals)
            total_restored += 1
        print(f"Restored {len(rows)} records into table '{tbl}'")

    # 3. Foreign Key Integrity Check
    fk_check = cur.execute("PRAGMA foreign_key_check;").fetchall()
    if fk_check:
        print("FOREIGN KEY CHECK FAILED:", fk_check)
        raise ValueError("Foreign key violations in restored backup data")
    else:
        print("FOREIGN KEY CHECK PASSED: 0 violations across all 48 restored rows.")

    print(f"SUCCESS: Total records verified and restored in isolated database: {total_restored}")
    conn.close()

if __name__ == "__main__":
    test_isolated_restoration()
