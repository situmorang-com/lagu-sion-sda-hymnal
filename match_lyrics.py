import json, re, html, sqlite3, csv
from difflib import SequenceMatcher

lyrics = {int(k): v for k, v in json.load(open('/tmp/sda_lyrics.json')).items()}
sda = {int(k): v for k, v in json.load(open('/tmp/sda_index.json')).items()}

def norm(s):
    s = html.unescape(s or '').lower().replace('&', ' and ')
    s = re.sub(r"[^a-z0-9 ]", ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

# Pre-normalize corpus: title + lyrics, and a set of normalized lines
corpus = {}
for num in sda:
    title_n = norm(sda[num])
    lyr = lyrics.get(num, '')
    lines = [norm(l) for l in lyr.split('\n') if len(l.strip()) > 3]
    full_n = norm(title_n + ' ' + ' '.join(lines))
    corpus[num] = {'title_n': title_n, 'lines': lines, 'full_n': full_n}

def best_match(et):
    """Return (confidence, num, how) for an LS English title vs SDA corpus."""
    na = norm(et)
    if not na or len(na) < 4:
        return (0.0, None, '')
    best = (0.0, None, '')
    for num, c in corpus.items():
        # 1) exact title match
        if na == c['title_n']:
            return (1.0, num, 'title-exact')
        score = 0.0; how = ''
        # 2) title equals a full lyric line (first line / refrain), exact
        for ln in c['lines']:
            if len(ln) < 8:
                continue
            if na == ln:
                score = max(score, 0.99); how = 'lyric-line-exact'
            elif len(na) >= 14 and na in ln:
                # title is a long substring of a real lyric line
                ratio = len(na) / len(ln)        # how much of the line the title covers
                if ratio >= 0.55:
                    cand = 0.90 + 0.08 * ratio
                    if cand > score: score, how = cand, 'lyric-line-substr'
        # 3) title prefix relationship (length-tolerant, but must overlap a lot)
        if score < 0.9:
            tn = c['title_n']
            if tn and len(na) >= 10 and (tn.startswith(na) or na.startswith(tn)):
                ratio = min(len(na), len(tn)) / max(len(na), len(tn))
                if ratio >= 0.6:
                    cand = 0.85 + 0.1 * ratio
                    if cand > score: score, how = cand, 'title-prefix'
        # 4) fuzzy on title (informational fallback, never auto-applied)
        if score < 0.85:
            seq = SequenceMatcher(None, na, c['title_n']).ratio()
            if seq > score: score, how = seq, 'title-fuzzy'
        if score > best[0]:
            best = (round(score, 3), num, how)
    return best

con = sqlite3.connect('lagu_sion.db'); con.row_factory = sqlite3.Row
rows = con.execute(
    "SELECT number, title, english_title FROM songs "
    "WHERE sda_source IS NULL AND english_title <> '' ORDER BY number"
).fetchall()

results = []
for r in rows:
    conf, num, how = best_match(r['english_title'])
    results.append({
        'ls_number': r['number'], 'ls_title': r['title'],
        'english_title': html.unescape(r['english_title']),
        'sda_num': num, 'sda_title': sda.get(num, '') if num else '',
        'confidence': conf, 'method': how
    })
con.close()

results.sort(key=lambda x: -x['confidence'])

print(f"{'CONF':>5}  {'METHOD':<18} LS#   {'LS English title':<34} -> SDA candidate")
print('-'*110)
for x in results:
    cand = f"#{x['sda_num']} {x['sda_title']}" if x['sda_num'] else '(none)'
    print(f"{x['confidence']*100:4.0f}%  {x['method']:<18} {x['ls_number']:<4} "
          f"{x['english_title'][:34]:<34} -> {cand}")

json.dump(results, open('/tmp/lyric_match.json','w'))
with open('sda_lyric_match.csv','w',newline='') as f:
    w=csv.writer(f)
    w.writerow(['confidence','method','ls_number','ls_title','ls_english_title','sda_num','sda_title'])
    for x in results:
        w.writerow([x['confidence'],x['method'],x['ls_number'],x['ls_title'],
                    x['english_title'],x['sda_num'] or '',x['sda_title']])

ge90 = [x for x in results if x['confidence'] >= 0.90]
print(f"\n>=90%: {len(ge90)}   |   80-90%: {len([x for x in results if 0.8<=x['confidence']<0.9])}"
      f"   |   <80%: {len([x for x in results if x['confidence']<0.8])}")
print("Written: sda_lyric_match.csv")
