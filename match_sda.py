import sqlite3, json, re, csv
from difflib import SequenceMatcher

sda = {int(k): v for k, v in json.load(open('/tmp/sda_index.json')).items()}

def norm(s):
    s = (s or '').lower()
    s = s.replace('&', 'and')
    s = re.sub(r"[^a-z0-9 ]", ' ', s)   # drop punctuation/apostrophes
    s = re.sub(r'\s+', ' ', s).strip()
    return s

# Build normalized SDA lookup (exact) and a list for fuzzy
sda_norm = {}
for num, title in sda.items():
    sda_norm.setdefault(norm(title), num)
sda_items = [(num, title, norm(title)) for num, title in sda.items()]

con = sqlite3.connect('lagu_sion.db')
con.row_factory = sqlite3.Row
rows = con.execute(
    "SELECT number, title, english_title FROM songs "
    "WHERE sda_hymnal_num IS NULL AND english_title <> '' ORDER BY number"
).fetchall()

exact, strong, medium, none = [], [], [], []

for r in rows:
    et = r['english_title']
    n = norm(et)
    if n in sda_norm:
        num = sda_norm[n]
        exact.append((r['number'], r['title'], et, num, sda[num], 1.0))
        continue
    # fuzzy: best ratio against all SDA titles
    best_num, best_title, best_score = None, None, 0.0
    for num, title, tn in sda_items:
        sc = SequenceMatcher(None, n, tn).ratio()
        if sc > best_score:
            best_num, best_title, best_score = num, title, sc
    rec = (r['number'], r['title'], et, best_num, best_title, round(best_score, 3))
    if best_score >= 0.9:
        strong.append(rec)
    elif best_score >= 0.72:
        medium.append(rec)
    else:
        none.append(rec)

def show(label, items):
    print(f"\n{'='*90}\n{label}: {len(items)}\n{'='*90}")
    for ls_num, ls_title, et, sda_num, sda_title, sc in items:
        print(f"LS#{ls_num:<4} {ls_title[:34]:<34} | EN: {et[:30]:<30} -> SDA#{sda_num} {sda_title}  ({sc})")

show("EXACT MATCHES (auto-apply, confidence 1.0)", exact)
show("STRONG FUZZY (>=0.90, very likely correct)", strong)
show("MEDIUM FUZZY (0.72-0.90, REVIEW)", medium)
print(f"\nNO CONFIDENT MATCH: {len(none)} (likely genuinely not in SDA Hymnal)")

# Write full review CSV
with open('sda_match_candidates.csv', 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['confidence_bucket','ls_number','ls_title','ls_english_title','sda_num','sda_title','score'])
    for bucket, items in [('exact',exact),('strong',strong),('medium',medium),('none',none)]:
        for ls_num, ls_title, et, sda_num, sda_title, sc in items:
            w.writerow([bucket, ls_num, ls_title, et,
                        sda_num if bucket!='none' else '',
                        sda_title if bucket!='none' else '', sc])

# Save auto-applicable (exact + strong) for the apply step
json.dump(
    [{'ls_number': i[0], 'sda_num': i[3], 'sda_title': sda[i[3]]} for i in (exact + strong)],
    open('/tmp/sda_auto.json', 'w')
)
print(f"\nAuto-applicable (exact+strong): {len(exact)+len(strong)}")
print("Review file written: sda_match_candidates.csv")
con.close()
