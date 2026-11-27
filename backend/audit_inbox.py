import os
import sys
from database import get_supabase

sb = get_supabase()

def audit():
    print("=== AUDITING REPLY INBOX ===")
    drafts = sb.table('reply_drafts').select('*').order('created_at', desc=True).execute().data or []
    print(f"Total drafts in database: {len(drafts)}")
    
    # Check pending
    pending = [d for d in drafts if d.get('status') == 'pending']
    print(f"Total pending drafts: {len(pending)}")
    
    # Group by conversation
    conv_map = {}
    for d in pending:
        c_id = d.get('conversation_id')
        conv_map.setdefault(c_id, []).append(d)
        
    print(f"\nConversations with pending drafts: {len(conv_map)}")
    
    for c_id, d_list in conv_map.items():
        # Get conversation title and contact
        c_res = sb.table('conversations').select('*').eq('id', c_id).execute().data
        conv_info = c_res[0] if c_res else {}
        title = conv_info.get('title', 'Unknown')
        contact_id = conv_info.get('contact_id')
        
        contact_info = {}
        if contact_id:
            ct_res = sb.table('contacts').select('*').eq('id', contact_id).execute().data
            contact_info = ct_res[0] if ct_res else {}
            
        contact_name = contact_info.get('display_name', title)
        is_selected = contact_info.get('is_selected', False)
        auto_reply_enabled = contact_info.get('auto_reply_enabled', False)
        
        print(f"\n--- Conversation: {title} | Contact: {contact_name} (ID: {contact_id}) ---")
        print(f"    Selected: {is_selected} | AutoReply: {auto_reply_enabled} | Draft Count: {len(d_list)}")
        
        for d in d_list:
            s_id = d.get('source_message_id')
            msg_res = sb.table('messages').select('*').eq('id', s_id).execute().data if s_id else []
            msg = msg_res[0] if msg_res else None
            msg_text = msg.get('body') if msg else "(NO SOURCE MESSAGE)"
            draft_text = d.get('draft_text') or "(EMPTY DRAFT)"
            print(f"    - Draft ID: {d['id'][:8]} | SourceMsg: {s_id[:8] if s_id else 'None'} | Created: {d['created_at']}")
            print(f"      Inbound: {msg_text[:60]}")
            print(f"      Draft:   {draft_text[:60]}")

if __name__ == '__main__':
    audit()
