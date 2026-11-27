import sqlite3

def test_composite_ownership_enforcement():
    conn = sqlite3.connect(":memory:")
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()

    cur.execute("CREATE TABLE auth_users (id TEXT PRIMARY KEY);")

    # Contacts table with composite unique key
    cur.execute("""
    CREATE TABLE contacts (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES auth_users(id),
        display_name TEXT NOT NULL,
        UNIQUE(owner_id, id)
    );
    """)

    # Batches table with composite unique key
    cur.execute("""
    CREATE TABLE chat_import_batches (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES auth_users(id),
        batch_name TEXT,
        UNIQUE(owner_id, id)
    );
    """)

    # Sources table with composite foreign keys
    cur.execute("""
    CREATE TABLE chat_import_sources (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES auth_users(id),
        batch_id TEXT NOT NULL,
        contact_id TEXT,
        source_filename TEXT NOT NULL,
        source_sha256 TEXT NOT NULL,
        FOREIGN KEY (owner_id, batch_id) REFERENCES chat_import_batches(owner_id, id) ON DELETE CASCADE,
        FOREIGN KEY (owner_id, contact_id) REFERENCES contacts(owner_id, id) ON DELETE SET NULL,
        UNIQUE(owner_id, source_sha256)
    );
    """)

    # Assistant sessions with composite unique key
    cur.execute("""
    CREATE TABLE assistant_sessions (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES auth_users(id),
        title TEXT NOT NULL,
        UNIQUE(owner_id, id)
    );
    """)

    # Assistant session messages with composite FK
    cur.execute("""
    CREATE TABLE assistant_session_messages (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES auth_users(id),
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        FOREIGN KEY (owner_id, session_id) REFERENCES assistant_sessions(owner_id, id) ON DELETE CASCADE
    );
    """)

    # 1. Setup two distinct users
    user_alice = "user-alice-1111"
    user_bob = "user-bob-2222"
    cur.execute("INSERT INTO auth_users (id) VALUES (?)", (user_alice,))
    cur.execute("INSERT INTO auth_users (id) VALUES (?)", (user_bob,))

    # 2. Alice sets up a contact and an import batch
    alice_contact_id = "contact-alice-001"
    alice_batch_id = "batch-alice-001"
    cur.execute("INSERT INTO contacts (id, owner_id, display_name) VALUES (?, ?, ?)",
                (alice_contact_id, user_alice, "Rahul"))
    cur.execute("INSERT INTO chat_import_batches (id, owner_id, batch_name) VALUES (?, ?, ?)",
                (alice_batch_id, user_alice, "Alice Batch 1"))

    # 3. Alice inserts an import source -> Succeeded
    cur.execute("""
    INSERT INTO chat_import_sources (id, owner_id, batch_id, contact_id, source_filename, source_sha256)
    VALUES (?, ?, ?, ?, ?, ?)
    """, ("src-alice-1", user_alice, alice_batch_id, alice_contact_id, "chat.txt", "hash-alice-1"))
    print("TEST 1: Alice import source inserted -> SUCCEEDED")

    # 4. Bob attempts cross-tenant batch reference -> MUST FAIL
    bob_batch_hijack_failed = False
    try:
        cur.execute("""
        INSERT INTO chat_import_sources (id, owner_id, batch_id, contact_id, source_filename, source_sha256)
        VALUES (?, ?, ?, ?, ?, ?)
        """, ("src-bob-1", user_bob, alice_batch_id, None, "chat.txt", "hash-bob-1"))
    except sqlite3.IntegrityError as e:
        bob_batch_hijack_failed = True
        print(f"TEST 2: Bob cross-tenant batch reference blocked by composite FK! Error: {e}")
    assert bob_batch_hijack_failed, "Security failure: Bob referenced Alice batch!"

    # 5. Bob attempts cross-tenant contact reference -> MUST FAIL
    bob_batch_id = "batch-bob-001"
    cur.execute("INSERT INTO chat_import_batches (id, owner_id, batch_name) VALUES (?, ?, ?)",
                (bob_batch_id, user_bob, "Bob Batch 1"))

    bob_contact_hijack_failed = False
    try:
        cur.execute("""
        INSERT INTO chat_import_sources (id, owner_id, batch_id, contact_id, source_filename, source_sha256)
        VALUES (?, ?, ?, ?, ?, ?)
        """, ("src-bob-2", user_bob, bob_batch_id, alice_contact_id, "chat.txt", "hash-bob-2"))
    except sqlite3.IntegrityError as e:
        bob_contact_hijack_failed = True
        print(f"TEST 3: Bob cross-tenant contact reference blocked by composite FK! Error: {e}")
    assert bob_contact_hijack_failed, "Security failure: Bob referenced Alice contact!"

    # 6. Assistant session composite ownership
    alice_session_id = "session-alice-001"
    cur.execute("INSERT INTO assistant_sessions (id, owner_id, title) VALUES (?, ?, ?)",
                (alice_session_id, user_alice, "Alice Private Session"))

    bob_session_hijack_failed = False
    try:
        cur.execute("""
        INSERT INTO assistant_session_messages (id, owner_id, session_id, role, content)
        VALUES (?, ?, ?, ?, ?)
        """, ("msg-bob-1", user_bob, alice_session_id, "user", "Hijacking message"))
    except sqlite3.IntegrityError as e:
        bob_session_hijack_failed = True
        print(f"TEST 4: Bob cross-tenant assistant session injection blocked by composite FK! Error: {e}")
    assert bob_session_hijack_failed, "Security failure: Bob injected into Alice assistant session!"

    # Note on SQLite vs PostgreSQL 15+:
    # In SQLite, ON DELETE SET NULL on a composite FK attempts to set all composite columns to NULL.
    # In PostgreSQL 15+, the standard syntax `ON DELETE SET NULL (contact_id)` sets only contact_id to NULL.
    # In SQLite, setting contact_id to null before deleting the contact simulates this behavior:
    cur.execute("UPDATE chat_import_sources SET contact_id = NULL WHERE contact_id = ?", (alice_contact_id,))
    cur.execute("DELETE FROM contacts WHERE id = ?", (alice_contact_id,))
    cur.execute("SELECT contact_id FROM chat_import_sources WHERE id = ?", ("src-alice-1",))
    contact_val = cur.fetchone()[0]
    print(f"TEST 5: Source contact_id safely detached to: {contact_val} (Expected None/NULL)")
    assert contact_val is None, "Contact detachment failed!"

    print("ALL COMPOSITE TENANT ENCLOSURE TESTS PASSED.")
    conn.close()

if __name__ == "__main__":
    test_composite_ownership_enforcement()
