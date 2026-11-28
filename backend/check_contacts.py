import sys
sys.path.insert(0, '.')
from database import get_supabase
sb = get_supabase()
res = sb.table('contacts').select('id,display_name,phone_e164,is_selected,auto_reply_enabled,reply_mode').eq('owner_id','2b1d6345-be7c-44e6-ac31-3db4e9145b44').order('display_name').execute()
print(f"{'display_name':<35} {'selected':<10} {'auto_reply':<12} {'mode'}")
print("-"*75)
for c in res.data:
    print(f"{str(c.get('display_name','?'))[:35]:<35} {str(c.get('is_selected')):<10} {str(c.get('auto_reply_enabled')):<12} {c.get('reply_mode')}")
