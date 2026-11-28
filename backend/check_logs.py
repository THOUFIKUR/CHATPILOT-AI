import sys
sys.path.insert(0, '.')
from database import get_supabase
sb = get_supabase()
res = sb.table('activity_logs').select('id,event_type,description,metadata,created_at').order('created_at',desc=True).limit(25).execute()
print(f"{'Time':19s} {'Event':35s} {'Description'}")
print("-"*110)
for r in res.data:
    meta = r.get('metadata') or {}
    desc = r.get('description','')[:55]
    extra = ''
    for k in ('reason','pipeline_status','sender','contact'):
        if meta.get(k):
            extra += f" | {k}={meta[k]}"
    print(f"{r['created_at'][:19]} {r['event_type']:35s} {desc}{extra}")
