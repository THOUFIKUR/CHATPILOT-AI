import os
import json
from datetime import datetime
from database import get_supabase

sb = get_supabase()

def run_safe_cleanup():
    os.makedirs('backups', exist_ok=True)
    backup_file = f"backups/reply_drafts_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    # 1. Backup all drafts
    all_drafts = sb.table('reply_drafts').select('*').execute().data or []
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(all_drafts, f, indent=2, ensure_ascii=False)
    print(f"Backed up {len(all_drafts)} drafts to {backup_file}")
    
    # IDs from dry-run
    empty_draft_ids = [
        'ab7dac9c-f60c-43f6-95ff-377ebc3330f5',
        'a021ecdd-61eb-47eb-ba68-d0e82c815250',
        'c615a3c1-3a20-418c-868d-8acaeeac9acb',
        '8612253d-6bfe-4a9f-b52e-c12e9a6234e6',
        '517498a2-6269-4451-94cd-7e8ed03bdb29',
        'c27d2dc7-9d3d-4647-9ed7-4a4754555dd2',
        'c13e5375-2302-4e74-9f4c-24ede64d2202'
    ]
    
    group_draft_ids = [
        '238991f1-3ebf-4cae-9477-8fa064ca5d8c',
        '13c870ac-4bbf-4a97-8d19-d8e6a1ca8965',
        '9abb73df-6a3f-4e08-9df5-635c186835a0',
        'dc88636f-b5b6-4557-aa14-87cf7a19bb6a',
        'd7f98a19-9aa8-45d4-8d48-6a56b3e9447e',
        'a69561f4-7e43-4741-99b5-697b03c76fc4',
        '4970171e-42d1-4295-bf60-3366fcdd833f',
        'f132e41a-3d33-4bf8-9b79-764cc879a23e'
    ]
    
    duplicate_draft_ids = [
        'f84e3cf0-252f-4628-9dd0-26402434608c',
        'b67522fb-1b1d-460a-880e-0eb7cfa5786d'
    ]
    
    # Archive empty drafts
    for d_id in empty_draft_ids:
        sb.table('reply_drafts').update({
            'status': 'failed',
            'send_result': {'reason': 'empty_draft_cleaned'}
        }).eq('id', d_id).execute()
        
    # Archive group drafts
    for d_id in group_draft_ids:
        sb.table('reply_drafts').update({
            'status': 'rejected',
            'send_result': {'reason': 'group_draft_archived'}
        }).eq('id', d_id).execute()
        
    # Archive duplicate drafts
    for d_id in duplicate_draft_ids:
        sb.table('reply_drafts').update({
            'status': 'rejected',
            'send_result': {'reason': 'duplicate_draft_archived'}
        }).eq('id', d_id).execute()
        
    # Verify remaining pending drafts
    res = sb.table('reply_drafts').select('id, draft_text, status').eq('status', 'pending').execute()
    remaining = res.data or []
    print(f"Cleanup successfully applied! Remaining valid pending drafts: {len(remaining)}")

if __name__ == '__main__':
    run_safe_cleanup()
