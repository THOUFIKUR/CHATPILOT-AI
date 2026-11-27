import os
import sys
from database import get_supabase

sb = get_supabase()

def dry_run_cleanup():
    print("=======================================================")
    print("REPLY INBOX AUDIT & DRY-RUN CLEANUP REPORT")
    print("=======================================================")
    
    # 1. Fetch all pending drafts
    res = sb.table('reply_drafts').select('*, conversations(*, contacts(*))').eq('status', 'pending').execute()
    pending = res.data or []
    print(f"Total pending drafts found: {len(pending)}")
    
    empty_drafts = []
    group_drafts = []
    duplicate_drafts = []
    valid_drafts = []
    
    # Track (conversation_id, source_message_id) and (conversation_id, draft_text)
    seen_source_msgs = {}
    seen_conv_text = {}
    
    for d in pending:
        d_id = d['id']
        text = (d.get('draft_text') or '').strip()
        conv = d.get('conversations') or {}
        c_title = conv.get('title') or ''
        group_id = conv.get('group_id')
        contact = conv.get('contacts') or {}
        contact_name = contact.get('display_name') or c_title or 'Unknown'
        source_id = d.get('source_message_id')
        
        # Check source message text
        msg_body = ""
        if source_id:
            m_res = sb.table('messages').select('*').eq('id', source_id).execute().data
            if m_res:
                msg_body = m_res[0].get('body') or ""
                
        # Classification 1: Empty draft
        if not text:
            empty_drafts.append({
                "draft_id": d_id,
                "contact": contact_name,
                "created_at": d.get('created_at'),
                "source_msg": msg_body,
                "reason": "Draft text is empty/blank"
            })
            continue
            
        # Classification 2: WhatsApp Groups (groups are strictly not authorized for auto-replies)
        if group_id or "volunteers" in contact_name.lower() or "robotics" in contact_name.lower() or "group" in contact_name.lower():
            group_drafts.append({
                "draft_id": d_id,
                "contact": contact_name,
                "created_at": d.get('created_at'),
                "draft_text": text,
                "source_msg": msg_body,
                "reason": "Group conversation drafts not authorized in 1-to-1 reply inbox"
            })
            continue
            
        # Classification 3: Duplicate of an existing source message or exact duplicate text
        conv_id = d.get('conversation_id')
        key_source = (conv_id, source_id) if source_id else None
        key_text = (conv_id, msg_body.strip().lower()) if msg_body else None
        
        if key_source and key_source in seen_source_msgs:
            duplicate_drafts.append({
                "draft_id": d_id,
                "duplicate_of": seen_source_msgs[key_source],
                "contact": contact_name,
                "created_at": d.get('created_at'),
                "draft_text": text,
                "source_msg": msg_body,
                "reason": f"Duplicate draft for same incoming message {source_id}"
            })
            continue
            
        if key_text and key_text in seen_conv_text:
            duplicate_drafts.append({
                "draft_id": d_id,
                "duplicate_of": seen_conv_text[key_text],
                "contact": contact_name,
                "created_at": d.get('created_at'),
                "draft_text": text,
                "source_msg": msg_body,
                "reason": f"Duplicate draft for same incoming text '{msg_body}'"
            })
            continue
            
        if key_source:
            seen_source_msgs[key_source] = d_id
        if key_text:
            seen_conv_text[key_text] = d_id
            
        valid_drafts.append({
            "draft_id": d_id,
            "contact": contact_name,
            "created_at": d.get('created_at'),
            "draft_text": text,
            "source_msg": msg_body
        })

    print(f"\n1. Empty Drafts (to archive/clean): {len(empty_drafts)}")
    for e in empty_drafts:
        print(f"   - [{e['draft_id'][:8]}] {e['contact']} | Created: {e['created_at']} | Inbound: '{e['source_msg']}'")
        
    print(f"\n2. Group Drafts (to archive): {len(group_drafts)}")
    for g in group_drafts:
        print(f"   - [{g['draft_id'][:8]}] {g['contact']} | Draft: '{g['draft_text'][:40]}' | Inbound: '{g['source_msg'][:40]}'")
        
    print(f"\n3. Duplicate Drafts (to archive): {len(duplicate_drafts)}")
    for dup in duplicate_drafts:
        print(f"   - [{dup['draft_id'][:8]}] Dup of [{dup['duplicate_of'][:8]}] | {dup['contact']} | Inbound: '{dup['source_msg']}'")
        
    print(f"\n4. Genuine Valid Pending Drafts Preserved: {len(valid_drafts)}")
    for v in valid_drafts:
        print(f"   - [{v['draft_id'][:8]}] {v['contact']} | Inbound: '{v['source_msg']}' | Draft: '{v['draft_text']}'")

if __name__ == '__main__':
    dry_run_cleanup()
